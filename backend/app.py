from flask import Flask, request, jsonify
import tensorflow as tf
import joblib
from tensorflow.keras.preprocessing.sequence import pad_sequences
from better_profanity import profanity
from flask_cors import CORS
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import datetime
from pymongo import MongoClient
import schedule
import time
from bson import ObjectId
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import OneHotEncoder
from prediction.model import BookingLoadPredictor

print("Сервер запущено...")

# Підключення до MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["computerClub"]
collection = db["devices"]
collectionUsers = db["users"]
price_table_collection = db["priceTable"]

# Отримання даних за останній тиждень
import datetime
today = datetime.datetime.now()
last_week = today - datetime.timedelta(days=7)

bookings = list(collection.find({
    "bookings.startTime": {"$gte": last_week.isoformat()}
}))

processed_data = []

for booking in bookings:
    for entry in booking["bookings"]:
        start_time = datetime.datetime.fromisoformat(entry["startTime"])
        processed_data.append({
            "hour": start_time.hour,
            "dayOfWeek": start_time.weekday(),
            "isWeekend": start_time.weekday() >= 5,
            "zone": booking["zone"]
        })

df = pd.DataFrame(processed_data)

class SentimentModelWithFilter:
    def __init__(self, model_path, tokenizer_path, profanity_file):
        self.model = tf.keras.models.load_model(model_path)
        with open(tokenizer_path, 'rb') as f:
            self.tokenizer = joblib.load(f)
        self.maxlen = 200
        self.load_profanity_list(profanity_file)

    def load_profanity_list(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            bad_words = [line.strip() for line in f if line.strip()]
        profanity.load_censor_words(bad_words)

    def blur_profanity(self, text):
        return profanity.censor(text)

    def predict_sentiment(self, text):
        en_text = text  # Використовуємо текст без перекладу
        tokenized_text = self.tokenizer.texts_to_sequences([en_text])
        padded_text = pad_sequences(tokenized_text, maxlen=self.maxlen)
        prediction = self.model.predict(padded_text)
        sentiment = "Positive" if prediction[0] > 0.5 else "Negative"

        if prediction[0] > 0.7:
            sentiment = "Positive"
        elif prediction[0] < 0.5:
            sentiment = "Negative"
        else:
            sentiment = "Neutral"

        processed_text = self.blur_profanity(text)
        return sentiment, processed_text

# Ініціалізація Flask API
app = Flask(__name__)
CORS(app)

# Ініціалізація моделі
model_path = "prediction-model/sentiment_model_amazon100k.h5"
tokenizer_path = "prediction-model/tokenizer_amazon100k.pkl"
profanity_file = "prediction-model/ukrainian-profanity.txt"
sentiment_model = SentimentModelWithFilter(model_path, tokenizer_path, profanity_file)

# === Прогноз завантаженості ===
load_model_path = "prediction-model/bookings/booking_load_model.pkl"
zone_encoder_path = "prediction-model/bookings/zone_encoder.pkl"

booking_model = joblib.load(load_model_path)
zone_encoder = joblib.load(zone_encoder_path)

@app.route('/')
def home():
    return "API is running!"

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/api/analyze', methods=['POST'])
def predict():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Invalid input"}), 400

    text = data['text']
    sentiment, processed_text = sentiment_model.predict_sentiment(text)

    return jsonify({
        "original_text": text,
        "processed_text": processed_text,
        "sentiment": sentiment
    })
    
@app.route('/api/price-table', methods=['GET'])
def get_price_table():
    try:
        price_table = list(price_table_collection.find())
        for entry in price_table:
            entry["_id"] = str(entry["_id"])  # Перетворення ObjectId у рядок
        return jsonify(price_table), 200
    except Exception as e:
        print(f"❌ Помилка під час отримання таблиці цін: {e}")
        return jsonify({"error": "Server error"}), 500
    
@app.route('/api/price-table', methods=['POST'])
def update_price_table():
    try:
        data = request.get_json()
        if not data or "zone" not in data or "prices" not in data:
            return jsonify({"error": "Invalid input"}), 400

        zone = data["zone"]
        prices = data["prices"]

        # Оновлення або створення запису
        price_table_collection.update_one(
            {"zone": zone},
            {"$set": {"prices": prices}},
            upsert=True
        )

        return jsonify({"message": "Price table updated successfully"}), 200
    except Exception as e:
        print(f"❌ Помилка під час оновлення таблиці цін: {e}")
        return jsonify({"error": "Server error"}), 500
    
def calculate_price(zone, duration):
    try:
        # Отримання таблиці цін для зони
        price_entry = price_table_collection.find_one({"zone": zone})
        if not price_entry:
            raise ValueError(f"Ціни для зони '{zone}' не знайдено")

        prices = price_entry["prices"]

        # Знаходимо найближчу тривалість
        closest_duration = max([int(d) for d in prices.keys() if int(d) <= duration], default=1)
        return prices[str(closest_duration)]
    except Exception as e:
        print(f"❌ Помилка під час обчислення ціни: {e}")
        return 0

    
@app.route('/api/predict-load', methods=['POST'])
def predict_booking_load():
    try:
        data = request.get_json()
        start_date = data.get("startDate")
        end_date = data.get("endDate")

        # Перетворення дат у формат datetime
        start_date = datetime.datetime.fromisoformat(start_date)
        end_date = datetime.datetime.fromisoformat(end_date)

        # Генерація даних для прогнозу
        future_days = [start_date + datetime.timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        print("future_days:", future_days)  # Логування

        processed_data = []
        for day in future_days:
            for hour in range(8, 24):  # Години роботи клубу
                for zone in ['Pro', 'VIP', 'PS']:  # Зони клубу
                    processed_data.append({
                        "hour": hour,
                        "dayOfWeek": day.weekday(),  # 0 - понеділок, 6 - неділя
                        "isWeekend": day.weekday() >= 5,
                        "zone": zone,
                        "date": day.strftime('%Y-%m-%d')  # Додано дату
                    })

        df = pd.DataFrame(processed_data)
        print("DataFrame перед кодуванням зон:", df.head())  # Логування

        # Кодування зон
        zone_encoded = zone_encoder.transform(df[['zone']])
        zone_cols = zone_encoder.get_feature_names_out(['zone'])
        zone_encoded_df = pd.DataFrame(zone_encoded, columns=zone_cols)

        df = pd.concat([df, zone_encoded_df], axis=1)

        # Прогноз
        X = df[['hour', 'dayOfWeek', 'isWeekend'] + list(zone_cols)]
        print("Форма X:", X.shape)  # Логування
        predictions = np.round(booking_model.predict(X)).astype(int)
        df['prediction'] = predictions

        # Групування результатів
        if start_date == end_date:
            result = (
                df.groupby(['hour', 'zone'])['prediction']
                .sum()
                .round(1)
                .reset_index()
                .rename(columns={"prediction": "expectedBookings"})
            )

        else:
            result = (
                df.groupby('date')['prediction']
                .sum()
                .round(1)
                .reset_index()
                .rename(columns={"prediction": "expectedBookings"})
            )

        return jsonify(result.to_dict(orient="records"))
    except Exception as e:
        print("❌ Прогноз помилка:", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/retrain-model', methods=['POST'])
def retrain_model_endpoint():
    result = retrain_model()
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result), 200

def retrain_model():
    try:
        today = datetime.datetime.now()
        last_month = today - datetime.timedelta(days=30)  # Розширено період до місяця

        # Отримання всіх пристроїв
        devices = list(collection.find())

        processed_data = []
        for device in devices:
            if "zone" not in device:
                print(f"❌ Поле 'zone' відсутнє у документі: {device}")
                continue

            if "bookings" in device and device["bookings"]:
                for entry in device["bookings"]:
                    if "startTime" in entry:
                        start_time = entry["startTime"]
                        if isinstance(start_time, str):
                            start_time = datetime.datetime.fromisoformat(start_time)

                        if start_time >= last_month:
                            processed_data.append({
                                "hour": start_time.hour,
                                "dayOfWeek": start_time.weekday(),
                                "isWeekend": start_time.weekday() >= 5,
                                "zone": device["zone"],
                                "bookings": 1
                            })
            else:
                processed_data.append({
                    "hour": None,
                    "dayOfWeek": None,
                    "isWeekend": None,
                    "zone": device["zone"],
                    "bookings": 0
                })

        print("Оброблені дані для DataFrame:", processed_data)

        if not processed_data:
            raise ValueError("❌ processed_data порожній. Дані не були оброблені.")

        # Завантаження попередніх даних
        file_path = "./prediction-model/bookings/previous_training_data.csv"
        if os.path.exists(file_path):
            previous_data = pd.read_csv(file_path)
        else:
            previous_data = pd.DataFrame(columns=["hour", "dayOfWeek", "isWeekend", "zone", "bookings"])
            previous_data.to_csv(file_path, index=False)  # Збережені попередні дані
        new_data = pd.DataFrame(processed_data)

        # Заповнення пропущених значень
        new_data = new_data.fillna({
            "hour": 0,
            "dayOfWeek": 0,
            "isWeekend": False,
            "bookings": 0
        })

        # Об'єднання нових і старих даних
        combined_data = pd.concat([previous_data, new_data], ignore_index=True)

        # Збереження об'єднаних даних для майбутнього використання
        combined_data.to_csv("previous_training_data.csv", index=False)

        # Кодування зон
        if "zone" not in combined_data.columns:
            raise ValueError("Поле 'zone' відсутнє у DataFrame")

        zone_encoded = zone_encoder.transform(combined_data[['zone']])
        zone_cols = zone_encoder.get_feature_names_out(['zone'])
        zone_encoded_df = pd.DataFrame(zone_encoded, columns=zone_cols)

        combined_data = pd.concat([combined_data, zone_encoded_df], axis=1)

        # Підготовка даних для навчання
        X_new = combined_data[['hour', 'dayOfWeek', 'isWeekend'] + list(zone_cols)]
        y_new = combined_data['bookings']

        if X_new.isnull().values.any():
            raise ValueError("❌ X_new містить NaN. Перевірте дані.")

        # Додавання ваг для нових даних
        weights = [0.2] * len(previous_data) + [0.8] * len(new_data)  # Менший вплив нових даних

        # Донавчання моделі
        booking_model.fit(X_new, y_new, sample_weight=weights)

        # Збереження оновленої моделі
        joblib.dump(booking_model, load_model_path)
        print("✅ Модель успішно донавчена та збережена.")

        return {"message": "Модель успішно донавчена."}
    except Exception as e:
        print("❌ Помилка донавчання моделі:", str(e))
        return {"error": str(e)}
    
def schedule_retraining():
    schedule.every().sunday.at("23:59").do(retrain_model)

    while True:
        schedule.run_pending()
        time.sleep(1)

# Запуск автоматичного донавчання в окремому потоці
import threading
threading.Thread(target=schedule_retraining).start()

@app.route('/api/user-profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        print(f"🔍 Пошук користувача з ID: {user_id}")  # Логування ID користувача

        # Видалення зайвих символів із user_id
        user_id = user_id.strip("<>")  # Видаляємо кутові дужки, якщо вони є
        print(f"🔍 Очищений ID користувача: {user_id}")  # Логування очищеного ID

        # Перетворення user_id у ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except Exception as e:
            print(f"❌ Некоректний формат ID: {user_id}. Помилка: {e}")
            return jsonify({"error": "Invalid user ID format"}), 400

        # Отримання користувача з бази даних
        user = collectionUsers.find_one({"_id": user_object_id})
        if not user:
            print(f"❌ Користувача з ID {user_id} не знайдено в базі даних.")  # Логування
            return jsonify({"error": "User not found"}), 404

        print(f"✅ Користувач знайдений: {user}")  # Логування знайденого користувача

        # Отримання всіх пристроїв із бронюваннями користувача
        devices = db.devices.find({"bookings.userId": user_id})
        bookings = []
        for device in devices:
            zone = device.get("zone")  # Отримуємо зону з пристрою
            device_type = device.get("type")  # Отримуємо тип пристрою
            for booking in device["bookings"]:
                if booking["userId"] == user_id:
                    bookings.append({
                        "zone": zone,
                        "type": device_type,
                        "startTime": booking["startTime"],
                        "endTime": booking["endTime"],
                        "price": booking["price"]
                    })

        if not bookings:
            print(f"ℹ️ У користувача з ID {user_id} немає бронювань.")  # Логування
            return jsonify({"message": "No bookings found for this user"}), 200

        # Збір інформації про користувача
        zones = [b["zone"] for b in bookings]
        most_common_zone = max(set(zones), key=zones.count)

        types = [b["type"] for b in bookings]
        most_common_type = max(set(types), key=types.count)

        durations = []
        for b in bookings:
            start_time = b["startTime"]
            end_time = b["endTime"]

            # Перевірка типу startTime і endTime
            if isinstance(start_time, str):
                start_time = datetime.datetime.fromisoformat(start_time)
            if isinstance(end_time, str):
                end_time = datetime.datetime.fromisoformat(end_time)

            # Обчислення тривалості
            durations.append((end_time - start_time).total_seconds() / 3600)

        avg_duration = np.mean(durations)

        start_hours = []
        for b in bookings:
            start_time = b["startTime"]

            # Перевірка типу startTime
            if isinstance(start_time, str):
                start_time = datetime.datetime.fromisoformat(start_time)

            start_hours.append(start_time.hour)

        avg_start_hour = np.mean(start_hours)

        prices = [b["price"] for b in bookings]
        avg_price = np.mean(prices)

        # Формування профілю користувача
        user_profile = {
            "userId": user_id,
            "username": user["username"],
            "email": user["email"],
            "most_common_zone": most_common_zone,
            "most_common_type": most_common_type,
            "avg_duration": avg_duration,
            "avg_start_hour": avg_start_hour,
            "avg_price": avg_price,
        }

        print(f"✅ Профіль користувача сформовано: {user_profile}")  # Логування профілю користувача

        return jsonify(user_profile), 200

    except Exception as e:
        print(f"❌ Помилка під час отримання профілю користувача: {e}")  # Логування помилки
        return jsonify({"error": "Server error"}), 500
    
@app.route('/api/device-vectors', methods=['GET'])
def get_device_vectors():
    try:
        # Отримання всіх пристроїв із бази даних
        devices = list(collection.find())
        if not devices:
            print("❌ Пристрої не знайдено в базі даних.")
            return jsonify({"error": "No devices found"}), 404

        device_vectors = []
        for device in devices:
            zone = device.get("zone", "Unknown")  # Зона пристрою
            device_type = device.get("type", "Unknown")  # Тип пристрою

            # Історія бронювань
            bookings = device.get("bookings", [])
            if bookings:
                durations = []
                start_hours = []
                prices = []

                for booking in bookings:
                    start_time = booking["startTime"]
                    end_time = booking["endTime"]
                    price = booking.get("price", 0)

                    # Перевірка типу startTime і endTime
                    if isinstance(start_time, str):
                        start_time = datetime.datetime.fromisoformat(start_time)
                    if isinstance(end_time, str):
                        end_time = datetime.datetime.fromisoformat(end_time)

                    # Обчислення тривалості
                    durations.append((end_time - start_time).total_seconds() / 3600)
                    start_hours.append(start_time.hour)
                    prices.append(price)

                avg_duration = np.mean(durations)
                avg_start_hour = np.mean(start_hours)
                avg_price = np.mean(prices)
            else:
                avg_duration = 0
                avg_start_hour = 0
                avg_price = 0

            # Формування вектора пристрою
            device_vector = {
                "deviceId": str(device["_id"]),  # Перетворення ObjectId у рядок
                "id": device.get("id", "Unknown"),  # Додаємо назву пристрою (id)
                "zone": zone,
                "type": device_type,
                "avg_duration": avg_duration,
                "avg_start_hour": avg_start_hour,
                "avg_price": avg_price
            }
            device_vectors.append(device_vector)

        print(f"✅ Вектори пристроїв сформовано: {device_vectors}")  # Логування
        return jsonify(device_vectors), 200

    except Exception as e:
        print(f"❌ Помилка під час формування векторів пристроїв: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/recommendations/<user_id>', methods=['GET'])
def get_recommendations(user_id):
    try:
        # Отримання профілю користувача
        user_profile_response = get_user_profile(user_id)
        if user_profile_response[1] != 200:
            return user_profile_response  # Повертаємо помилку, якщо профіль не знайдено

        user_profile = user_profile_response[0].json
        #print(f"✅ Профіль користувача: {user_profile}")

        # Отримання векторів пристроїв
        device_vectors_response = get_device_vectors()
        if device_vectors_response[1] != 200:
            return device_vectors_response  # Повертаємо помилку, якщо пристрої не знайдено

        device_vectors = device_vectors_response[0].json
        #print(f"✅ Вектори пристроїв: {device_vectors}")

        # One-hot encoding для зон і типів
        encoder = OneHotEncoder()
        zones = [user_profile["most_common_zone"]] + [d["zone"] for d in device_vectors]
        types = [user_profile["most_common_type"]] + [d["type"] for d in device_vectors]

        zone_encoded = encoder.fit_transform(np.array(zones).reshape(-1, 1)).toarray()
        type_encoded = encoder.fit_transform(np.array(types).reshape(-1, 1)).toarray()

        # Побудова вектора профілю користувача
        user_vector = np.concatenate([
            zone_encoded[0],
            type_encoded[0],
            [user_profile["avg_duration"], user_profile["avg_start_hour"], user_profile["avg_price"]],
        ])

        # Побудова векторів пристроїв
        device_vectors_encoded = [
            np.concatenate([
                zone_encoded[i + 1],
                type_encoded[i + 1],
                [d["avg_duration"], d["avg_start_hour"], d["avg_price"]],
            ])
            for i, d in enumerate(device_vectors)
        ]

        # Обчислення косинусної схожості
        similarities = cosine_similarity([user_vector], device_vectors_encoded)[0]
        print(f"✅ Косинусна схожість: {similarities}")

        # Сортування пристроїв за схожістю
        sorted_devices = sorted(
            zip(device_vectors, similarities),
            key=lambda x: x[1],
            reverse=True
        )

        # Вибір топ-3 пристроїв
        top_3_devices = [
            {
                "deviceId": d["deviceId"],
                "zone": d["zone"],
                "type": d["type"],
                "avg_duration": d["avg_duration"],
                "avg_start_hour": d["avg_start_hour"],
                "avg_price": d["avg_price"],
                "similarity": sim
            }
            for d, sim in sorted_devices[:3]
        ]

        print(f"✅ Топ-3 пристрої: {top_3_devices}")
        return jsonify(top_3_devices), 200

    except Exception as e:
        print(f"❌ Помилка під час обчислення рекомендацій: {e}")
        return jsonify({"error": "Server error"}), 500
        

@app.route('/api/recommendations/filtered/<user_id>', methods=['GET'])
def get_recommendations_with_filter(user_id):
    try:
        # Отримання профілю користувача
        user_profile_response = get_user_profile(user_id)
        if user_profile_response[1] != 200:
            return user_profile_response  # Повертаємо помилку, якщо профіль не знайдено

        user_profile = user_profile_response[0].json

        # Отримання векторів пристроїв
        device_vectors_response = get_device_vectors()
        if device_vectors_response[1] != 200:
            return device_vectors_response  # Повертаємо помилку, якщо пристрої не знайдено

        device_vectors = device_vectors_response[0].json

        # Отримання бронювань користувача
        devices = db.devices.find({"bookings.userId": user_id})
        user_bookings = []
        for device in devices:
            for booking in device["bookings"]:
                if booking["userId"] == user_id:
                    user_bookings.append({
                        "deviceId": str(device["_id"]),
                        "startTime": booking["startTime"],
                        "endTime": booking["endTime"]
                    })

        # Фільтрація пристроїв, які вже заброньовані у найближчі 2 дні
        now = datetime.datetime.now()
        two_days_from_now = now + datetime.timedelta(days=2)

        booked_device_ids = set()
        for booking in user_bookings:
            start_time = booking["startTime"]
            if isinstance(start_time, str):
                start_time = datetime.datetime.fromisoformat(start_time)
            if now <= start_time < two_days_from_now:
                booked_device_ids.add(booking["deviceId"])

        # Фільтруємо пристрої, які не заброньовані
        filtered_devices = [
            device for device in device_vectors
            if device["deviceId"] not in booked_device_ids and (
                device["avg_duration"] > 0 or device["avg_price"] > 0 or device["avg_start_hour"] > 0
            )
        ]

        # Оновлення тривалості та ціни
        def get_closest_duration(durations, target_duration):
            return min(durations, key=lambda x: abs(x - target_duration))

        for d in filtered_devices:
            available_durations = [int(duration) for duration in price_table_collection.find_one({"zone": d["zone"]})["prices"].keys()]
            if available_durations:
                d["avg_duration"] = get_closest_duration(available_durations, d["avg_duration"])
                d["avg_price"] = calculate_price(d["zone"], d["avg_duration"])
            else:
                d["avg_duration"] = 1
                d["avg_price"] = 0

        # One-hot encoding для зон і типів
        encoder = OneHotEncoder()
        zones = [user_profile["most_common_zone"]] + [d["zone"] for d in filtered_devices]
        types = [user_profile["most_common_type"]] + [d["type"] for d in filtered_devices]

        zone_encoded = encoder.fit_transform(np.array(zones).reshape(-1, 1)).toarray()
        type_encoded = encoder.fit_transform(np.array(types).reshape(-1, 1)).toarray()

        # Побудова вектора профілю користувача
        user_vector = np.concatenate([
            zone_encoded[0],
            type_encoded[0],
            [user_profile["avg_duration"] * 2,  # Вага тривалості
             user_profile["avg_start_hour"] * 1.5,  # Вага часу початку
             user_profile["avg_price"]]
        ])

        # Побудова векторів пристроїв
        device_vectors_encoded = [
            np.concatenate([
                zone_encoded[i + 1],
                type_encoded[i + 1],
                [d["avg_duration"], d["avg_start_hour"], d["avg_price"]],
            ])
            for i, d in enumerate(filtered_devices)
        ]

        # Обчислення косинусної схожості
        similarities = cosine_similarity([user_vector], device_vectors_encoded)[0]

        # Сортування пристроїв за схожістю
        sorted_devices = sorted(
            zip(filtered_devices, similarities),
            key=lambda x: x[1],
            reverse=True
        )

        # Вибір топ-3 пристроїв
        top_3_devices = [
            {
                "deviceId": d["deviceId"],
                "id": d.get("id", "Unknown"),  # Додаємо назву пристрою (id)
                "zone": d["zone"],
                "type": d["type"],
                "avg_duration": d["avg_duration"],
                "avg_start_hour": d["avg_start_hour"],
                "avg_price": d["avg_price"],
                "similarity": sim
            }
            for d, sim in sorted_devices[:3]
        ]

        print(f"✅ Топ-3 пристрої після фільтрації: {top_3_devices}")
        return jsonify(top_3_devices), 200

    except Exception as e:
        print(f"❌ Помилка під час обчислення рекомендацій: {e}")
        return jsonify({"error": "Server error"}), 500

from prediction.model import train_and_predict

@app.route('/api/custom-predict', methods=['POST'])
def custom_predict():
    try:
        data = request.get_json()
        train_from = data.get("trainFrom")
        train_to = data.get("trainTo")
        predict_from = data.get("predictFrom")
        predict_to = data.get("predictTo")
        use_all = data.get("useAll", False)

        result = train_and_predict(train_from, train_to, predict_from, predict_to, use_all=use_all)
        return jsonify(result), 200
    except Exception as e:
        print(f"❌ Помилка у /api/custom-predict: {e}")
        return jsonify({"error": str(e)}), 500
  

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
