import sys
import os
import sklearn
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from pymongo import MongoClient
from bson.objectid import ObjectId
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE
import logging
import pickle
from constrained_logistic import ConstrainedLogisticRegression

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

logger.info(f"Версія sklearn: {sklearn.__version__}")

try:
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    db = client["computerClub"]
    devices_collection = db["devices"]
    users_collection = db["users"]
    client.admin.command("ping")
    logger.info("Підключено до MongoDB")
    logger.info(f"Кількість документів у devices: {devices_collection.count_documents({})}")
    logger.info(f"Кількість документів у users: {users_collection.count_documents({})}")
except Exception as e:
    logger.error(f"Помилка підключення до MongoDB: {str(e)}")
    sys.exit(1)

def prepare_data():
    data = []
    labels = []
    logger.info("Початок обробки даних")
    missing_users = set()
    skipped_bookings = 0

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
                if user_id_obj not in missing_users:
                    missing_users.add(user_id_obj)
                skipped_bookings += 1
                continue

            try:
                start_time = booking["startTime"]
                end_time = booking.get("endTime")
                if isinstance(start_time, str):
                    start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                if isinstance(end_time, str):
                    end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                if not end_time:
                    end_time = start_time + timedelta(hours=1)
                booking_duration = max((end_time - start_time).total_seconds() / 3600, 0.5)
            except Exception as e:
                logger.error(f"Помилка обробки startTime/endTime {booking.get('startTime')}: {e}")
                skipped_bookings += 1
                continue

            total_bookings = sum(
                1 for d in devices_collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id
            )
            no_show_count = user.get("noShowCount", 0)
            cancel_count = user.get("cancelCount", 0)

            frac_no_show = no_show_count / total_bookings if total_bookings else 0
            frac_cancel = cancel_count / total_bookings if total_bookings else 0

            is_weekend = 1 if start_time.weekday() >= 5 else 0
            hour_category = 0 if start_time.hour < 12 else (1 if start_time.hour < 18 else 2)
            zone_type = {"Pro": 0, "VIP": 1, "PS": 2}.get(zone, 0)

            is_no_show = int(booking.get("status") == "noShow")
            is_cancelled = int(booking.get("status") == "cancelled")
            label = 1 if is_no_show or is_cancelled else 0

            data.append([
                no_show_count,
                cancel_count,
                booking_duration,
                is_weekend,
                hour_category,
                zone_type,
                frac_no_show,
                frac_cancel
            ])
            labels.append(label)

    if not data:
        logger.error("Немає даних для тренування")
        raise ValueError("Немає даних для тренування")

    logger.info(f"Пропущено бронювань: {skipped_bookings}")
    logger.info(f"Незнайдені userId: {missing_users if missing_users else 'немає'}")
    return np.array(data), np.array(labels)

def train_model():
    logger.info("Початок тренування моделі no-show (Constrained Logistic Regression)")
    try:
        X, y = prepare_data()
        logger.info(f"Зразків: {len(X)}, міток '1': {sum(y)}, міток '0': {len(y) - sum(y)}")

        feature_names = [
            "no_show_count", "cancel_count", "booking_duration", "is_weekend",
            "hour_category", "zone_type", "frac_no_show", "frac_cancel"
        ]
        df_X = pd.DataFrame(X, columns=feature_names)
        corr_matrix = df_X.corr().round(3)
        logger.info("Кореляційна матриця ознак:")
        logger.info("\n" + corr_matrix.to_string())

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        logger.info(f"Навчальна вибірка: {len(X_train)}, тестова: {len(X_test)}")

        smote = SMOTE(sampling_strategy=1.0, random_state=42)
        X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)
        logger.info(f"Після SMOTE: зразків={len(X_train_balanced)}, міток '1'={sum(y_train_balanced)}")

        scaler = StandardScaler()
        X_train_balanced = scaler.fit_transform(X_train_balanced)
        X_test = scaler.transform(X_test)

        param_grid = {
            'C': [0.1, 1, 10, 100, 1000],
            'class_weight': [{0: 1, 1: w} for w in [3, 5, 7, 10]]
        }
        base_model = ConstrainedLogisticRegression(
            random_state=42,
            penalty='l2'
        )
        grid_search = GridSearchCV(base_model, param_grid, cv=5, scoring='roc_auc', n_jobs=-1)
        grid_search.fit(X_train_balanced, y_train_balanced)
        best_model = grid_search.best_estimator_
        logger.info(f"Найкращі параметри: {grid_search.best_params_}")
        logger.info(f"Класи моделі: {best_model.classes_}")

        model = CalibratedClassifierCV(best_model, cv=10, method="isotonic")
        model.fit(X_train_balanced, y_train_balanced)
        logger.info(f"Класи каліброваної моделі: {model.classes_}")

        # Валідаційні метрики
        y_pred = model.predict(X_test)
        logger.info("Оцінка на тестовій вибірці:\n" + classification_report(y_test, y_pred))
        roc_auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
        logger.info(f"ROC-AUC на тестовій вибірці: {roc_auc:.2f}")

        feature_names = [
            "no_show_count", "cancel_count", "booking_duration", "is_weekend",
            "hour_category", "zone_type", "frac_no_show", "frac_cancel"
        ]
        coef = model.calibrated_classifiers_[0].estimator.coef_[0]
        logger.info("Коефіцієнти ознак:")
        for name, coef_val in zip(feature_names, coef):
            logger.info(f"{name}: {coef_val:.4f}")

        probs = model.predict_proba(X_test)[:, 1]
        high_risk_probs = probs[y_test == 1]
        low_risk_probs = probs[y_test == 0]
        logger.info(f"Ймовірності no-show (тестова вибірка): середнє={np.mean(probs):.2f}, медіана={np.median(probs):.2f}, макс={np.max(probs):.2f}, мін={np.min(probs):.2f}")
        logger.info(f"Ймовірності для проблемних (y=1): середнє={np.mean(high_risk_probs):.2f}, кількість={len(high_risk_probs)}")
        logger.info(f"Ймовірності для непроблемних (y=0): середнє={np.mean(low_risk_probs):.2f}, кількість={len(low_risk_probs)}")

        os.makedirs("trained_models_logistic", exist_ok=True)
        with open("trained_models_logistic/model.pkl", "wb") as f:
            pickle.dump(model, f)
        with open("trained_models_logistic/scaler.pkl", "wb") as f:
            pickle.dump(scaler, f)
        logger.info("Модель ConstrainedLogisticRegression збережено: trained_models_logistic/model.pkl")
        logger.info("Scaler збережено: trained_models_logistic/scaler.pkl")
    except Exception as e:
        logger.error(f"Помилка: {str(e)}")
        raise

if __name__ == "__main__":
    train_model()