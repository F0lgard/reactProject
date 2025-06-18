import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import joblib
import os
from pymongo import MongoClient
from datetime import datetime, timedelta
import datetime as dt
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Підключення до MongoDB
try:
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
    db = client["computerClub"]
    users_collection = db["users"]
    devices_collection = db["devices"]
    client.admin.command("ping")
    logger.info("Підключено до MongoDB")
except Exception as e:
    logger.error(f"Помилка підключення до MongoDB: {str(e)}")
    exit(1)

# Генерація фічей
def generate_features():
    users = list(users_collection.find({}))
    current_time = datetime.now(dt.UTC)
    features_list = []

    for user in users:
        user_id = str(user["_id"])
        created_at = user.get("createdAt", current_time)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=dt.UTC)
        account_age_days = max((current_time - created_at).days, 1)

        bookings = []
        for device in devices_collection.find({"bookings.userId": user_id}):
            for booking in device["bookings"]:
                if booking["userId"] == user_id:
                    bookings.append(booking)

        total_bookings = len(bookings)
        completed_bookings = sum(1 for b in bookings if b["status"] == "completed")
        no_show_count = sum(1 for b in bookings if b["status"] == "noShow")
        cancel_count = sum(1 for b in bookings if b["status"] == "cancelled")

        avg_duration = (
            sum(
                (b["endTime"] - b["startTime"]).total_seconds() / 3600
                for b in bookings
                if isinstance(b["startTime"], datetime) and isinstance(b["endTime"], datetime)
            ) / total_bookings
            if total_bookings > 0
            else 0
        )

        completed_ratio = completed_bookings / total_bookings if total_bookings > 0 else 0
        booking_frequency = total_bookings / account_age_days * 30 if account_age_days > 0 else 0

        last_booking = max(
            (b["startTime"] for b in bookings if isinstance(b["startTime"], datetime)),
            default=current_time - timedelta(days=365)
        )
        if last_booking.tzinfo is None:
            last_booking = last_booking.replace(tzinfo=dt.UTC)
        days_since_last_booking = max((current_time - last_booking).days, 0)

        features_list.append({
            "userId": user_id,
            "totalBookings": total_bookings,
            "noShowCount": no_show_count,
            "cancelCount": cancel_count,
            "daysSinceLastBooking": days_since_last_booking,
            "accountAgeDays": account_age_days,
            "avgDuration": avg_duration,
            "completed_ratio": completed_ratio,
            "booking_frequency": booking_frequency
        })

    return pd.DataFrame(features_list)

# Класифікація користувача
def classify_user(row):
    completed_ratio = row["completed_ratio"]
    total_bookings = row["totalBookings"]
    booking_frequency = row["booking_frequency"]
    days_since_last_booking = row["daysSinceLastBooking"]
    account_age_days = row["accountAgeDays"]

    if account_age_days < 14 and total_bookings <= 1:
        return "new"
    if days_since_last_booking > 14 and completed_ratio < 0.8:
        return "at_risk"
    if total_bookings >= 10 and completed_ratio >= 0.8 and booking_frequency >= 1:
        return "active"
    return "passive"

# Основна логіка
logger.info("Початок обробки даних")
df = generate_features()
if df.empty:
    logger.error("Немає даних для обробки. Перевірте MongoDB.")
    exit(1)

df["label"] = df.apply(classify_user, axis=1)

# Логування розподілу класів
logger.info(f"Розподіл класів перед навчанням:\n{df['label'].value_counts().to_string()}")
if any(df["label"].value_counts() < 5):
    logger.warning("Деякі класи мають менше 5 прикладів. Модель може бути нестабільною.")

# Підготовка ознак
features = [
    "totalBookings",
    "noShowCount",
    "cancelCount",
    "daysSinceLastBooking",
    "accountAgeDays",
    "avgDuration",
    "completed_ratio",
    "booking_frequency"
]
corr_matrix = df[features].corr().round(3)
logger.info(f"Кореляційна матриця ознак:\n{corr_matrix.to_string()}")

X = df[features]
y = df["label"]

# Масштабування ознак
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Розділення на train/test
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y)

# Створення моделі Logistic Regression
clf = LogisticRegression(
    multi_class='multinomial',
    solver='lbfgs',
    class_weight='balanced',
    max_iter=1000,
    random_state=42
)

# Крос-валідація
cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
try:
    clf.fit(X_train, y_train)
    best_clf = clf
    scores = cross_val_score(best_clf, X_scaled, y, cv=cv, scoring="f1_macro")
    logger.info(f"Крос-валідація F1 (macro): середнє = {scores.mean():.3f}, стандартне відхилення = {scores.std():.3f}")
except ValueError as e:
    logger.error(f"Помилка при навчанні моделі: {e}")
    exit(1)

# Оцінка моделі
y_pred = best_clf.predict(X_test)
logger.info("\n📊 Звіт класифікації:\n" + classification_report(y_test, y_pred))

cm = confusion_matrix(y_test, y_pred, labels=best_clf.classes_)
cm_df = pd.DataFrame(cm, index=best_clf.classes_, columns=best_clf.classes_)
logger.info("\n📊 Confusion Matrix:\n" + cm_df.to_string())

# Ймовірності
y_probs = best_clf.predict_proba(X_test)
prob_df = pd.DataFrame(y_probs, columns=best_clf.classes_)
prob_df["true_label"] = y_test.values
logger.info("\n📉 Середні ймовірності за класами:")
for label in best_clf.classes_:
    mean_prob = prob_df[prob_df["true_label"] == label][label].mean()
    logger.info(f"Клас {label}: середня ймовірність = {mean_prob:.3f}")

# Помилки
misclassified = X_test[y_pred != y_test]
if len(misclassified) > 0:
    misclassified_df = pd.DataFrame(scaler.inverse_transform(misclassified), columns=features)
    misclassified_df["true_label"] = y_test[y_pred != y_test].values
    misclassified_df["predicted_label"] = y_pred[y_pred != y_test]
    logger.info("\n📊 Неправильно класифіковані користувачі:\n" + misclassified_df.to_string())

# Збереження моделі
os.makedirs("trained_models", exist_ok=True)
joblib.dump(best_clf, "trained_models/user_activity_model.pkl")
joblib.dump(scaler, "trained_models/scaler.pkl")
logger.info("✅ Модель збережено у 'trained_models/user_activity_model.pkl'")
logger.info("✅ Scaler збережено у 'trained_models/scaler.pkl'")

# Важливість ознак для Logistic Regression (за коефіцієнтами)
feature_importance = pd.DataFrame({
    "feature": features,
    "importance": np.abs(best_clf.coef_).mean(axis=0)
}).sort_values("importance", ascending=False)
logger.info("\n📈 Важливість фічей:\n" + feature_importance.to_string())
