import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from pymongo import MongoClient
from bson.objectid import ObjectId
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
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
    stats = {
        "no_show_count": [], "cancel_rate": [], "completed_bookings": [],
        "booking_duration": [], "hour_category": [], "is_weekend": [], "zone_type": []
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

            completed_bookings = sum(
                1 for d in devices_collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id and b.get("status") == "completed"
            )
            no_show_count = user.get("noShowCount", 0)
            cancel_count = user.get("cancelCount", 0)
            cancel_rate = cancel_count / (completed_bookings + 1e-5) if completed_bookings else 0

            hour_category = 0 if start_time.hour < 12 else (1 if start_time.hour < 18 else 2)
            is_weekend = 1 if start_time.weekday() >= 5 else 0
            zone_type = {"Pro": 0, "VIP": 1, "PS": 2}.get(zone, 0)

            is_no_show = int(booking.get("status") == "noShow")
            is_cancelled = int(booking.get("status") == "cancelled")
            label = 1 if is_no_show or is_cancelled else 0

            data.append([
                no_show_count,
                cancel_rate,
                completed_bookings,
                booking_duration,
                hour_category,
                is_weekend,
                zone_type
            ])
            labels.append(label)

            stats["no_show_count"].append(no_show_count)
            stats["cancel_rate"].append(cancel_rate)
            stats["completed_bookings"].append(completed_bookings)
            stats["booking_duration"].append(booking_duration)
            stats["hour_category"].append(hour_category)
            stats["is_weekend"].append(is_weekend)
            stats["zone_type"].append(zone_type)

    if not data:
        logger.error("Немає даних для тренування")
        raise ValueError("Немає даних для тренування")

    logger.info(f"Пропущено бронювань: {skipped_bookings}")
    logger.info(f"Незнайдені userId: {missing_users if missing_users else 'немає'}")
    for key, values in stats.items():
        logger.info(f"Статистика {key}: ненульових={sum(x > 0 for x in values)}, середнє={np.mean(values):.2f}, медіана={np.median(values):.2f}, макс={np.max(values):.2f}, мін={np.min(values):.2f}")

    return np.array(data), np.array(labels)

def train_model():
    logger.info("Початок тренування моделі no-show (Random Forest)")
    try:
        X, y = prepare_data()
        logger.info(f"Зразків: {len(X)}, міток '1': {sum(y)}, міток '0': {len(y) - sum(y)}")

        feature_names = [
            "no_show_count", "cancel_rate", "completed_bookings",
            "booking_duration", "hour_category", "is_weekend", "zone_type"
        ]
        df_X = pd.DataFrame(X, columns=feature_names)
        corr_matrix = df_X.corr().round(3)
        logger.info("Кореляційна матриця ознак:\n" + corr_matrix.to_string())

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        logger.info(f"Навчальна вибірка: {len(X_train)}, тестова: {len(X_test)}")

        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

        model = RandomForestClassifier(
            random_state=42,
            class_weight='balanced',
            max_features='sqrt'
        )
        param_grid = {
            'n_estimators': [50, 100, 200],
            'max_depth': [5, 10, 15],
            'min_samples_split': [5, 10],
            'min_samples_leaf': [2, 5]
        }
        grid_search = GridSearchCV(
            model, param_grid, cv=5, scoring='f1_macro', n_jobs=-1, verbose=1
        )
        grid_search.fit(X_train, y_train)
        logger.info(f"Найкращі параметри: {grid_search.best_params_}")
        logger.info(f"Найкращий F1-макро: {grid_search.best_score_:.3f}")

        best_model = grid_search.best_estimator_
        y_pred = best_model.predict(X_test)
        logger.info("Оцінка на тестовій вибірці (поріг=0.5):\n" + classification_report(y_test, y_pred))

        feature_importance = best_model.feature_importances_ * 100
        logger.info("Важливість ознак у відсотках:")
        for name, importance in zip(feature_names, feature_importance):
            logger.info(f"{name}: {importance:.2f}%")

        os.makedirs("trained_models", exist_ok=True)
        with open("trained_models/model.pkl", "wb") as f:
            pickle.dump(best_model, f)
        with open("trained_models/scaler.pkl", "wb") as f:
            pickle.dump(scaler, f)
        logger.info("Модель Random Forest збережено: trained_models/model.pkl")
        logger.info("Scaler збережено: trained_models/scaler.pkl")
    except Exception as e:
        logger.error(f"Помилка: {str(e)}")
        raise

if __name__ == "__main__":
    train_model()