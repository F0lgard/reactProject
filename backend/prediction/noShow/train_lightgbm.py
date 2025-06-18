import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from pymongo import MongoClient
from bson.objectid import ObjectId
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from lightgbm import LGBMClassifier
from sklearn.metrics import classification_report, roc_auc_score, precision_recall_curve, make_scorer, precision_score
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import ADASYN
import logging
import pickle

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

try:
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    db = client["computerClub"]
    devices_collection = db["devices"]
    users_collection = db["users"]
    client.admin.command("ping")
    logger.info("Підключено до MongoDB")
except Exception as e:
    logger.error(f"Помилка підключення до MongoDB: {str(e)}")
    sys.exit(1)

def focal_loss_scorer(y_true, y_pred_proba, alpha=0.25, gamma=8.0):
    y_pred_proba = np.clip(y_pred_proba, 1e-15, 1 - 1e-15)
    p_t = y_true * y_pred_proba + (1 - y_true) * (1 - y_pred_proba)
    alpha_t = y_true * alpha + (1 - y_true) * (1 - alpha)
    loss = -alpha_t * ((1 - p_t) ** gamma) * np.log(p_t)
    return -loss.mean()

focal_scorer = make_scorer(focal_loss_scorer, needs_proba=True, greater_is_better=False)
precision_scorer = make_scorer(precision_score, pos_label=1)

def parse_datetime(value):
    try:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value
        elif isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        else:
            raise ValueError(f"Невідомий формат: {type(value)}")
    except Exception as e:
        logger.error(f"Помилка парсингу часу {value}: {e}")
        return None

def prepare_data():
    data = []
    labels = []
    logger.info("Початок обробки даних")
    missing_users = set()
    skipped_bookings = 0
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    stats = {
        "has_no_show": [], "cancel_rate": [], "total_bookings": [], "recent_bookings": []
    }

    for device in devices_collection.find():
        device_id = device.get("id", "невідомий")
        zone = device.get("zone", "невідома")
        bookings = device.get("bookings", [])

        for booking in bookings:
            user_id = booking.get("userId")
            if not user_id:
                skipped_bookings += 1
                continue

            try:
                user_id_obj = ObjectId(user_id)
            except Exception:
                user_id_obj = user_id

            user = users_collection.find_one({"_id": user_id_obj})
            if not user:
                missing_users.add(str(user_id_obj))
                skipped_bookings += 1
                continue

            start_time = parse_datetime(booking.get("startTime"))
            end_time = parse_datetime(booking.get("endTime"))
            if not start_time:
                skipped_bookings += 1
                continue
            if not end_time:
                end_time = start_time + timedelta(hours=1)
            booking_duration = max((end_time - start_time).total_seconds() / 3600, 0.5)
            booking_duration = np.log1p(booking_duration)

            total_bookings = sum(
                1 for d in devices_collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id
            )
            recent_bookings = sum(
                1 for d in devices_collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id and parse_datetime(b.get("startTime"))
                and parse_datetime(b.get("startTime")) >= thirty_days_ago
            )
            no_show_count = user.get("noShowCount", 0)
            cancel_count = user.get("cancelCount", 0)
            cancel_rate = cancel_count / total_bookings if total_bookings else 0
            has_no_show = 1 if no_show_count > 0 else 0

            total_bookings = np.log1p(total_bookings)

            hour_category = 0 if start_time.hour < 12 else (1 if start_time.hour < 18 else 2)
            zone_type = {"Pro": 0, "VIP": 1, "PS": 2}.get(zone, 0)

            is_no_show = int(booking.get("status") == "noShow")
            is_cancelled = int(booking.get("status") == "cancelled")
            label = 1 if is_no_show or is_cancelled else 0

            data.append([
                cancel_rate,
                total_bookings,
                booking_duration,
                hour_category,
                zone_type,
                has_no_show
            ])
            labels.append(label)

            stats["has_no_show"].append(has_no_show)
            stats["cancel_rate"].append(cancel_rate)
            stats["total_bookings"].append(total_bookings)
            stats["recent_bookings"].append(recent_bookings)

    if not data:
        logger.error("Немає даних для тренування")
        raise ValueError("Немає даних для тренування")

    logger.info(f"Пропущено бронювань: {skipped_bookings}")
    logger.info(f"Незнайдені userId: {missing_users if missing_users else 'немає'}")
    for key, values in stats.items():
        logger.info(f"Статистика {key}: ненульових={sum(x > 0 for x in values)}, середнє={np.mean(values):.2f}, медіана={np.median(values):.2f}, макс={np.max(values):.2f}, мін={np.min(values):.2f}")

    return np.array(data), np.array(labels)

def train_model():
    logger.info("Початок тренування моделі no-show (LightGBM)")
    try:
        X, y = prepare_data()
        logger.info(f"Зразків: {len(X)}, міток '1': {sum(y)}, міток '0': {len(y) - sum(y)}")

        feature_names = [
            "cancel_rate", "total_bookings", "booking_duration",
            "hour_category", "zone_type", "has_no_show"
        ]
        df_X = pd.DataFrame(X, columns=feature_names)
        corr_matrix = df_X.corr().round(3)
        logger.info("Кореляційна матриця ознак:\n" + corr_matrix.to_string())

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        logger.info(f"Навчальна вибірка: {len(X_train)}, тестова: {len(X_test)}")

        adasyn = ADASYN(sampling_strategy=0.7, random_state=42)
        X_train_balanced, y_train_balanced = adasyn.fit_resample(X_train, y_train)
        logger.info(f"Після ADASYN: зразків={len(X_train_balanced)}, міток '1'={sum(y_train_balanced)}")

        scaler = StandardScaler()
        X_train_balanced = scaler.fit_transform(X_train_balanced)
        X_test = scaler.transform(X_test)

        lgbm = LGBMClassifier(random_state=42, min_split_gain=0.001)
        param_grid = {
            'n_estimators': [100],
            'max_depth': [5],
            'num_leaves': [5],
            'learning_rate': [0.01, 0.05],
            'scale_pos_weight': [0.5, 1],
            'min_child_samples': [1, 2],
            'reg_alpha': [1.0, 2.0],
            'reg_lambda': [2.0, 3.0]
        }
        scoring = {'focal_loss': focal_scorer, 'precision': precision_scorer}
        grid_search = GridSearchCV(lgbm, param_grid, cv=5, scoring=scoring, refit='precision', n_jobs=-1, verbose=1)
        logger.info("Початок GridSearchCV")
        grid_search.fit(X_train_balanced, y_train_balanced)
        logger.info(f"Найкращі параметри: {grid_search.best_params_}")
        logger.info(f"Найкращий precision score: {grid_search.best_score_:.4f}")

        best_model = grid_search.best_estimator_
        model = CalibratedClassifierCV(best_model, cv=20, method="sigmoid")
        model.fit(X_train_balanced, y_train_balanced)
        logger.info(f"Класи каліброваної моделі: {model.classes_}")

        non_calibrated_probs = best_model.predict_proba(X_test)[:, 1]
        logger.info(f"Некалібровані ймовірності no-show: середнє={np.mean(non_calibrated_probs):.2f}, медіана={np.median(non_calibrated_probs):.2f}, макс={np.max(non_calibrated_probs):.2f}, мін={np.min(non_calibrated_probs):.2f}")

        y_pred = model.predict(X_test)
        logger.info("Оцінка на тестовій вибірці (поріг=0.5):\n" + classification_report(y_test, y_pred))
        roc_auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
        logger.info(f"ROC-AUC на тестовій вибірці: {roc_auc:.2f}")

        probs = model.predict_proba(X_test)[:, 1]
        y_pred_threshold = (probs >= 0.3).astype(int)
        logger.info("Оцінка на тестовій вибірці (поріг=0.3):\n" + classification_report(y_test, y_pred_threshold))

        y_pred_high = (probs >= 0.6).astype(int)
        logger.info("Оцінка на тестовій вибірці (поріг=0.6):\n" + classification_report(y_test, y_pred_high))

        precision, recall, thresholds = precision_recall_curve(y_test, probs)
        logger.info("Precision-Recall крива (вибрані пороги):")
        for p, r, t in zip(precision[::5], recall[::5], thresholds[::5]):
            logger.info(f"Поріг={t:.2f}, Precision={p:.2f}, Recall={r:.2f}")

        feature_importance = best_model.feature_importances_ / np.sum(best_model.feature_importances_) * 100
        logger.info("Важливість ознак у відсотках:")
        for name, importance in zip(feature_names, feature_importance):
            logger.info(f"{name}: {importance:.2f}%")

        high_risk_probs = probs[y_test == 1]
        low_risk_probs = probs[y_test == 0]
        logger.info(f"Калібровані ймовірності no-show (тестова вибірка): середнє={np.mean(probs):.2f}, медіана={np.median(probs):.2f}, макс={np.max(probs):.2f}, мін={np.min(probs):.2f}")
        logger.info(f"Ймовірності для проблемних (y=1): середнє={np.mean(high_risk_probs):.2f}, кількість={len(high_risk_probs)}")
        logger.info(f"Ймовірності для непроблемних (y=0): середнє={np.mean(low_risk_probs):.2f}, кількість={len(low_risk_probs)}")

        os.makedirs("trained_models", exist_ok=True)
        with open("trained_models/model.pkl", "wb") as f:
            pickle.dump(model, f)
        with open("trained_models/scaler.pkl", "wb") as f:
            pickle.dump(scaler, f)
        logger.info("Модель LightGBM збережено: trained_models/model.pkl")
        logger.info("Scaler збережено: trained_models/scaler.pkl")
    except Exception as e:
        logger.error(f"Помилка: {str(e)}")
        raise

if __name__ == "__main__":
    train_model()