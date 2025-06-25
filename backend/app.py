from flask import Flask, request, jsonify, make_response
import tensorflow as tf
import joblib
from tensorflow.keras.preprocessing.sequence import pad_sequences
from better_profanity import profanity
from flask_cors import CORS
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import schedule
import time
from bson import ObjectId
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import OneHotEncoder
from prediction.model import train_model, predict_load, train_and_predict
import pytz
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import subprocess
import re
from flask import jsonify
from functools import lru_cache

import logging
logging.basicConfig(level=logging.DEBUG)


# Custom filter to suppress MongoDB driver logs
# Зміна рівня логування для pymongo
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)
# Ваше налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

print("Сервер запущено...")

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["computerClub"]
collection = db["devices"]
collectionUsers = db["users"]
price_table_collection = db["priceTable"]
activity_history_collection = db["activity_history"]

today = datetime.now()
last_week = today - timedelta(days=7)

bookings = list(collection.find({
    "bookings.startTime": {"$gte": last_week.isoformat()}
}))

processed_data = []
for booking in bookings:
    for entry in booking["bookings"]:
        start_time = datetime.fromisoformat(entry["startTime"])
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
        en_text = text
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

# Initialize Flask API
app = Flask(__name__)
CORS(app)

# Initialize sentiment model
model_path = "prediction-model/sentiment_model_amazon100k.h5"
tokenizer_path = "prediction-model/tokenizer_amazon100k.pkl"
profanity_file = "prediction-model/ukrainian-profanity.txt"
sentiment_model = SentimentModelWithFilter(model_path, tokenizer_path, profanity_file)

# Load prediction model
load_model_path = "prediction-model/bookings/booking_load_model.pkl"
zone_encoder_path = "prediction-model/bookings/zone_encoder.pkl"
booking_model = joblib.load(load_model_path)
zone_encoder = joblib.load(zone_encoder_path)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
    return response

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        logger.debug(f"OPTIONS request: {request.url}")
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response, 200

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

kiev_tz = pytz.timezone('Europe/Kiev')

@app.route('/api/price-table', methods=['GET'])
def get_price_table():
    try:
        price_table = list(price_table_collection.find())
        for entry in price_table:
            entry["_id"] = str(entry["_id"])
        logger.info("Price table retrieved successfully")
        return jsonify(price_table), 200
    except Exception as e:
        logger.error(f"Error retrieving price table: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/price-table', methods=['POST'])
def update_price_table():
    try:
        data = request.get_json()
        if not data or "zone" not in data or "originalPrices" not in data:
            return jsonify({"error": "Invalid input"}), 400

        zone = data["zone"]
        original_prices = data["originalPrices"]
        price_table_collection.update_one(
            {"zone": zone},
            {"$set": {"originalPrices": original_prices}},
            upsert=True
        )
        logger.info(f"Original prices updated for zone: {zone}")
        return jsonify({"message": "Original prices updated successfully"}), 200
    except Exception as e:
        logger.error(f"Error updating price table: {e}")
        return jsonify({"error": "Server error"}), 500

@lru_cache(maxsize=128)
def calculate_price(zone, duration, booking_start_time=None):
    try:
        price_entry = price_table_collection.find_one({"zone": zone})
        if not price_entry:
            logger.error(f"Original prices for zone '{zone}' not found")
            return 1  # Мін. ціна, щоб уникнути 0

        original_prices = price_entry.get("originalPrices", {})
        closest_duration = max([int(d) for d in original_prices.keys() if int(d) <= duration], default=1)
        base_price = original_prices.get(str(closest_duration), 1)  # Використовуємо originalPrices як базову ціну

        current_date = kiev_tz.localize(datetime.now())
        if booking_start_time:
            booking_start_time = pd.to_datetime(booking_start_time)
            if booking_start_time.tzinfo is None or booking_start_time.tzinfo.utcoffset(booking_start_time) is None:
                booking_start_time = kiev_tz.localize(booking_start_time)
            else:
                booking_start_time = booking_start_time.astimezone(kiev_tz)
        else:
            booking_start_time = current_date

        booking_time = booking_start_time.time()

        # Пошук знижок для конкретної зони або для "all"
        discounts = list(db.discounts.find({
            "$or": [
                {"zone": zone},
                {"zone": "all"}
            ],
            "startDate": {"$lte": booking_start_time.isoformat()},
            "endDate": {"$gte": booking_start_time.isoformat()}
        }))

        valid_discounts = []
        for disc in discounts:
            if 'specificPeriod' in disc and disc['specificPeriod']:
                try:
                    start_time_str, end_time_str = map(str.strip, disc['specificPeriod'].split('-'))
                    start_time = datetime.strptime(start_time_str, "%H:%M").time()
                    end_time = datetime.strptime(end_time_str, "%H:%M").time()
                    if start_time <= booking_time <= end_time:
                        valid_discounts.append(disc)
                except Exception as e:
                    logger.warning(f"Помилка specificPeriod '{disc['specificPeriod']}': {e}")
            else:
                valid_discounts.append(disc)

        if valid_discounts:
            applied_discount = max(valid_discounts, key=lambda d: d['discountPercentage'])
            logger.debug(f"Застосовано знижку {applied_discount['discountPercentage']}% для зони {zone}")
            return base_price * (1 - applied_discount['discountPercentage'] / 100)

        return base_price
    except Exception as e:
        logger.error(f"Error calculating price: {e}")
        return 1

@app.route('/api/calculate-price', methods=['POST'])
def calculate_price_endpoint():
    data = request.get_json()
    if not all(k in data for k in ['zone', 'duration']):
        return jsonify({"error": "Invalid input"}), 400
    booking_start_time = data.get('booking_start_time')
    price = calculate_price(data['zone'], data['duration'], booking_start_time)
    if price <= 0:
        logger.warning(f"Price calculated as {price} for zone {data['zone']}, setting to minimum 1")
        price = 1
    return jsonify({"price": price}), 200

@app.route('/api/discounts', methods=['POST'])
def create_discount():
    # check_admin()  # Перевірка ролі
    data = request.get_json()
    if not all(k in data for k in ['zone', 'startDate', 'endDate', 'discountPercentage']):
        return jsonify({"error": "Invalid input"}), 400

    try:
        # Перевірка знижки
        discount_percentage = float(data['discountPercentage'])
        if discount_percentage < 0 or discount_percentage > 100:
            return jsonify({"error": "Discount percentage must be between 0 and 100"}), 400

        # Перетворення дат у часову зону Києва
        start_date = pd.to_datetime(data['startDate']).astimezone(kiev_tz)
        end_date = pd.to_datetime(data['endDate']).astimezone(kiev_tz)

        start_date_str = start_date.isoformat()
        end_date_str = end_date.isoformat()

        logger.info(f"Received startDate: {data['startDate']}, Converted to Kiev: {start_date}, Saved as: {start_date_str}")
        logger.info(f"Received endDate: {data['endDate']}, Converted to Kiev: {end_date}, Saved as: {end_date_str}")

        # Формуємо документ знижки
        discount = {
            "zone": data['zone'],
            "startDate": start_date_str,
            "endDate": end_date_str,
            "discountPercentage": discount_percentage
        }

        if 'specificPeriod' in data and data['specificPeriod']:
            discount['specificPeriod'] = data['specificPeriod']

        # Зберігаємо знижку
        db.discounts.insert_one(discount)
        logger.info(f"Discount created for zone {data['zone']} with period {data.get('specificPeriod', 'Весь день')} and dates {start_date_str} - {end_date_str}")

        return jsonify({"message": "Discount created successfully. Prices will be applied dynamically."}), 200

    except ValueError:
        return jsonify({"error": "Invalid discount percentage"}), 400
    except Exception as e:
        logger.error(f"Error creating discount: {str(e)}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/discounts', methods=['GET'])
def get_discounts():
    # check_admin()
    discounts = list(db.discounts.find())
    for d in discounts:
        d['_id'] = str(d['_id'])
    return jsonify(discounts), 200

@app.route('/api/discounts/<discount_id>', methods=['DELETE'])
def delete_discount(discount_id):
    try:
        check_admin()  # Перевірка ролі
        discount = db.discounts.find_one({"_id": ObjectId(discount_id)})
        if not discount:
            return jsonify({"error": "Discount not found"}), 404

        db.discounts.delete_one({"_id": ObjectId(discount_id)})
        logger.info(f"Discount {discount_id} deleted successfully")
        return jsonify({"message": "Discount deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting discount: {str(e)}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/price-table/dynamic', methods=['GET'])
def get_dynamic_price_table():
    try:
        zones = ['Pro', 'VIP', 'PS']
        result = {}
        current_time = datetime.now().isoformat()

        for zone in zones:
            entry = price_table_collection.find_one({"zone": zone})
            if not entry or "originalPrices" not in entry:
                continue

            prices = {}
            for dur in entry["originalPrices"]:
                price = calculate_price(zone, int(dur), booking_start_time=current_time)
                prices[dur] = round(price, 2)

            result[zone] = prices

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error in dynamic price table: {e}")
        return jsonify({"error": "Server error"}), 500
    
@app.route('/api/predict-load', methods=['POST'])
def predict_booking_load():
    try:
        data = request.get_json()
        start_date = datetime.fromisoformat(data.get("startDate"))
        end_date = datetime.fromisoformat(data.get("endDate"))

        future_days = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        processed_data = []
        for day in future_days:
            for hour in range(8, 24):
                for zone in ['Pro', 'VIP', 'PS']:
                    processed_data.append({
                        "hour": hour,
                        "dayOfWeek": day.weekday(),
                        "isWeekend": day.weekday() >= 5,
                        "zone": zone,
                        "date": day.strftime('%Y-%m-%d')
                    })

        df = pd.DataFrame(processed_data)
        zone_encoded = zone_encoder.transform(df[['zone']])
        zone_cols = zone_encoder.get_feature_names_out(['zone'])
        zone_encoded_df = pd.DataFrame(zone_encoded, columns=zone_cols)
        df = pd.concat([df, zone_encoded_df], axis=1)

        X = df[['hour', 'dayOfWeek', 'isWeekend'] + list(zone_cols)]
        predictions = np.round(booking_model.predict(X)).astype(int)
        df['prediction'] = predictions

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

        logger.info("Booking load prediction completed")
        return jsonify(result.to_dict(orient="records"))
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/retrain-model', methods=['POST'])
def retrain_model_endpoint():
    result = retrain_model()
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result), 200

def retrain_model():
    try:
        today = datetime.now()
        last_month = today - timedelta(days=30)
        devices = list(collection.find())
        processed_data = []
        for device in devices:
            if "zone" not in device:
                logger.warning(f"Missing 'zone' field in document: {device}")
                continue
            if "bookings" in device and device["bookings"]:
                for entry in device["bookings"]:
                    if "startTime" in entry:
                        start_time = entry["startTime"]
                        if isinstance(start_time, str):
                            start_time = datetime.fromisoformat(start_time)
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

        if not processed_data:
            raise ValueError("processed_data is empty")
        file_path = "./prediction-model/bookings/previous_training_data.csv"
        if os.path.exists(file_path):
            previous_data = pd.read_csv(file_path)
        else:
            previous_data = pd.DataFrame(columns=["hour", "dayOfWeek", "isWeekend", "zone", "bookings"])
            previous_data.to_csv(file_path, index=False)
        new_data = pd.DataFrame(processed_data)
        new_data = new_data.fillna({
            "hour": 0,
            "dayOfWeek": 0,
            "isWeekend": False,
            "bookings": 0
        })
        combined_data = pd.concat([previous_data, new_data], ignore_index=True)
        combined_data.to_csv(file_path, index=False)

        zone_encoded = zone_encoder.transform(combined_data[['zone']])
        zone_cols = zone_encoder.get_feature_names_out(['zone'])
        zone_encoded_df = pd.DataFrame(zone_encoded, columns=zone_cols)
        combined_data = pd.concat([combined_data, zone_encoded_df], axis=1)

        X_new = combined_data[['hour', 'dayOfWeek', 'isWeekend'] + list(zone_cols)]
        y_new = combined_data['bookings']
        if X_new.isnull().values.any():
            raise ValueError("X_new contains NaN")
        weights = [0.2] * len(previous_data) + [0.8] * len(new_data)
        booking_model.fit(X_new, y_new, sample_weight=weights)
        joblib.dump(booking_model, load_model_path)
        logger.info("Model retrained and saved successfully")
        return {"message": "Model retrained successfully"}
    except Exception as e:
        logger.error(f"Model retraining error: {str(e)}")
        return {"error": str(e)}

def schedule_retraining():
    schedule.every().sunday.at("23:59").do(retrain_model)
    while True:
        schedule.run_pending()
        time.sleep(1)

import threading
threading.Thread(target=schedule_retraining).start()

@app.route('/api/user-profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        user_id = user_id.strip("<>")
        user_object_id = ObjectId(user_id)
        user = collectionUsers.find_one({"_id": user_object_id})
        if not user:
            logger.warning(f"User {user_id} not found")
            return jsonify({"error": "User not found"}), 404

        devices = db.devices.find({"bookings.userId": user_id})
        bookings = []
        for device in devices:
            zone = device.get("zone")
            device_type = device.get("type")
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
            logger.info(f"No bookings found for user {user_id}")
            return jsonify({"message": "No bookings found for this user"}), 200

        zones = [b["zone"] for b in bookings]
        most_common_zone = max(set(zones), key=zones.count)
        types = [b["type"] for b in bookings]
        most_common_type = max(set(types), key=types.count)
        durations = []
        for b in bookings:
            start_time = b["startTime"]
            end_time = b["endTime"]
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time)
            if isinstance(end_time, str):
                end_time = datetime.fromisoformat(end_time)
            durations.append((end_time - start_time).total_seconds() / 3600)
        avg_duration = np.mean(durations)
        start_hours = []
        for b in bookings:
            start_time = b["startTime"]
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time)
            start_hours.append(start_time.hour)
        avg_start_hour = np.mean(start_hours)
        prices = [b["price"] for b in bookings]
        avg_price = np.mean(prices)

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
        logger.info(f"User profile retrieved for {user_id}")
        return jsonify(user_profile), 200
    except Exception as e:
        logger.error(f"Error retrieving user profile: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/device-vectors', methods=['GET'])
def get_device_vectors():
    try:
        devices = list(collection.find())
        if not devices:
            logger.warning("No devices found")
            return jsonify({"error": "No devices found"}), 404

        device_vectors = []
        for device in devices:
            zone = device.get("zone", "Unknown")
            device_type = device.get("type", "Unknown")
            bookings = device.get("bookings", [])
            if bookings:
                durations = []
                start_hours = []
                prices = []
                for booking in bookings:
                    start_time = booking["startTime"]
                    end_time = booking["endTime"]
                    price = booking.get("price", 0)
                    if isinstance(start_time, str):
                        start_time = datetime.fromisoformat(start_time)
                    if isinstance(end_time, str):
                        end_time = datetime.fromisoformat(end_time)
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
            device_vectors.append({
                "deviceId": str(device["_id"]),
                "id": device.get("id", "Unknown"),
                "zone": zone,
                "type": device_type,
                "avg_duration": avg_duration,
                "avg_start_hour": avg_start_hour,
                "avg_price": avg_price
            })
        logger.info("Device vectors retrieved successfully")
        return jsonify(device_vectors), 200
    except Exception as e:
        logger.error(f"Error generating device vectors: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/recommendations/<user_id>', methods=['GET'])
def get_recommendations(user_id):
    try:
        user_profile_response = get_user_profile(user_id)
        if user_profile_response[1] != 200:
            return user_profile_response
        user_profile = user_profile_response[0].json
        device_vectors_response = get_device_vectors()
        if device_vectors_response[1] != 200:
            return device_vectors_response
        device_vectors = device_vectors_response[0].json

        encoder = OneHotEncoder()
        zones = [user_profile["most_common_zone"]] + [d["zone"] for d in device_vectors]
        types = [user_profile["most_common_type"]] + [d["type"] for d in device_vectors]
        zone_encoded = encoder.fit_transform(np.array(zones).reshape(-1, 1)).toarray()
        type_encoded = encoder.fit_transform(np.array(types).reshape(-1, 1)).toarray()

        user_vector = np.concatenate([
            zone_encoded[0],
            type_encoded[0],
            [user_profile["avg_duration"], user_profile["avg_start_hour"], user_profile["avg_price"]],
        ])
        device_vectors_encoded = [
            np.concatenate([
                zone_encoded[i + 1],
                type_encoded[i + 1],
                [d["avg_duration"], d["avg_start_hour"], d["avg_price"]],
            ])
            for i, d in enumerate(device_vectors)
        ]
        similarities = cosine_similarity([user_vector], device_vectors_encoded)[0]
        sorted_devices = sorted(
            zip(device_vectors, similarities),
            key=lambda x: x[1],
            reverse=True
        )
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
        logger.info(f"Recommendations generated for user {user_id}")
        return jsonify(top_3_devices), 200
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/recommendations/filtered/<user_id>', methods=['GET'])
def get_recommendations_with_filter(user_id):
    try:
        user_profile_response = get_user_profile(user_id)
        if user_profile_response[1] != 200:
            return user_profile_response
        user_profile = user_profile_response[0].json
        device_vectors_response = get_device_vectors()
        if device_vectors_response[1] != 200:
            return device_vectors_response
        device_vectors = device_vectors_response[0].json

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

        now = datetime.now()
        two_days_from_now = now + timedelta(days=2)
        booked_device_ids = set()
        for booking in user_bookings:
            start_time = booking["startTime"]
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time)
            if now <= start_time < two_days_from_now:
                booked_device_ids.add(booking["deviceId"])

        filtered_devices = [
            device for device in device_vectors
            if device["deviceId"] not in booked_device_ids and (
                device["avg_duration"] > 0 or device["avg_price"] > 0 or device["avg_start_hour"] > 0
            )
        ]

        def get_closest_duration(durations, target_duration):
            return min(durations, key=lambda x: abs(x - target_duration))

        for d in filtered_devices:
            price_entry = price_table_collection.find_one({"zone": d["zone"]})
            if price_entry and "originalPrices" in price_entry:
                available_durations = [int(duration) for duration in price_entry["originalPrices"].keys()]
                if available_durations:
                    d["avg_duration"] = get_closest_duration(available_durations, d["avg_duration"])
                    d["avg_price"] = calculate_price(d["zone"], d["avg_duration"])
                else:
                    d["avg_duration"] = 1
                    d["avg_price"] = 0
            else:
                d["avg_duration"] = 1
                d["avg_price"] = 0

        encoder = OneHotEncoder()
        zones = [user_profile["most_common_zone"]] + [d["zone"] for d in filtered_devices]
        types = [user_profile["most_common_type"]] + [d["type"] for d in filtered_devices]
        zone_encoded = encoder.fit_transform(np.array(zones).reshape(-1, 1)).toarray()
        type_encoded = encoder.fit_transform(np.array(types).reshape(-1, 1)).toarray()

        user_vector = np.concatenate([
            zone_encoded[0],
            type_encoded[0],
            [user_profile["avg_duration"] * 2, user_profile["avg_start_hour"] * 1.5, user_profile["avg_price"]]
        ])
        device_vectors_encoded = [
            np.concatenate([
                zone_encoded[i + 1],
                type_encoded[i + 1],
                [d["avg_duration"], d["avg_start_hour"], d["avg_price"]],
            ])
            for i, d in enumerate(filtered_devices)
        ]
        similarities = cosine_similarity([user_vector], device_vectors_encoded)[0]
        sorted_devices = sorted(
            zip(filtered_devices, similarities),
            key=lambda x: x[1],
            reverse=True
        )
        top_3_devices = [
            {
                "deviceId": d["deviceId"],
                "id": d.get("id", "Unknown"),
                "zone": d["zone"],
                "type": d["type"],
                "avg_duration": d["avg_duration"],
                "avg_start_hour": d["avg_start_hour"],
                "avg_price": d["avg_price"],
                "similarity": sim
            }
            for d, sim in sorted_devices[:3]
        ]
        logger.info(f"Filtered recommendations generated for user {user_id}")
        return jsonify(top_3_devices), 200
    except Exception as e:
        logger.error(f"Error generating filtered recommendations: {e}")
        return jsonify({"error": "Server error"}), 500

from prediction.model import train_and_predict

@app.route('/api/custom-predict', methods=['POST'])
def custom_predict():
    data = request.get_json()
    train_from = data.get('train_from')
    train_to = data.get('train_to')
    predict_from = data.get('predict_from')
    predict_to = data.get('predict_to')
    use_all = data.get('use_all', False)

    try:
        # Виклик функції для тренування та прогнозу
        result = train_and_predict(train_from, train_to, predict_from, predict_to, use_all)

        # Перевірка формату результату
        if not isinstance(result, dict) or "predictions" not in result or "recommendations" not in result:
            raise ValueError("Invalid format returned by train_and_predict")

        predictions = result["predictions"]
        recommendations = result["recommendations"]

        logger.info("Custom prediction and recommendations completed")
        return jsonify({
            "predictions": predictions,
            "recommendations": recommendations
        })
    except Exception as e:
        logger.error(f"Custom prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    
from prediction.noShow.model import NoShowPredictor

# Ініціалізація моделі no-show
predictor = None
try:
    predictor = NoShowPredictor(model_type="random_forest")
    if predictor.is_trained:
        logger.info("No-show model loaded successfully")
    else:
        logger.error("No-show model initialized but not trained")
        predictor = None
except Exception as e:
    logger.error(f"Error initializing no-show model: {str(e)}")
    predictor = None

# Ініціалізація моделі класифікації активності користувача
try:
    user_activity_model = joblib.load("prediction/userKlasifaer/trained_models/user_activity_model.pkl")
    logger.info("User activity model loaded successfully")
except FileNotFoundError:
    logger.error("User activity model file not found")
    user_activity_model = None

def check_admin():
    role = request.headers.get("role")
    if role != "admin":
        logger.warning("Unauthorized access attempt")
        response = jsonify({"error": "Admin access required"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 403
    return None

@app.route("/predict/no-show", methods=["GET", "OPTIONS"])
def predict_no_show():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    if not predictor or not predictor.is_trained:
        logger.error("❌ Модель no-show не завантажена або не навчена")
        response = jsonify({"error": "Model not ready"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

    try:
        user_id = request.args.get("userId")
        start_time_str = request.args.get("startTime")
        end_time_str = request.args.get("endTime")
        device_zone = request.args.get("deviceZone")
        device_id = request.args.get("deviceId")

        logger.info(f"📥 Запит no-show: userId={user_id}, startTime={start_time_str}, "
                    f"endTime={end_time_str}, deviceZone={device_zone}, deviceId={device_id}")

        if not all([user_id, start_time_str, device_zone]):
            logger.warning("⚠️ Відсутні обов'язкові параметри")
            return jsonify({"error": "Missing required parameters"}), 400

        start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00")) if end_time_str else start_time + timedelta(hours=1)
        booking_duration = max((end_time - start_time).total_seconds() / 3600, 0.5)

        user = collectionUsers.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"⚠️ Користувач {user_id} не знайдений")
            return jsonify({"error": "User not found"}), 404

        no_show_count = user.get("noShowCount", 0)
        cancel_count = user.get("cancelCount", 0)
        completed_bookings = sum(
            1 for d in collection.find({"bookings.userId": user_id})
            for b in d.get("bookings", [])
            if b.get("userId") == user_id and b.get("status") == "completed"
        )
        cancel_rate = cancel_count / (completed_bookings + 1e-5) if completed_bookings else 0

        hour_category = 0 if start_time.hour < 12 else (1 if start_time.hour < 18 else 2)
        is_weekend = 1 if start_time.weekday() >= 5 else 0
        zone_type = {"Pro": 0, "VIP": 1, "PS": 2}.get(device_zone, 0)

        logger.info(f"📊 Дані користувача для прогнозу:")
        logger.info(f"  - no_show_count: {no_show_count}")
        logger.info(f"  - cancel_rate: {cancel_rate:.3f}")
        logger.info(f"  - completed_bookings: {completed_bookings}")
        logger.info(f"  - booking_duration: {booking_duration:.2f}")
        logger.info(f"  - hour_category: {hour_category}")
        logger.info(f"  - is_weekend: {is_weekend}")
        logger.info(f"  - zone_type: {zone_type}")

        input_data = [[
            no_show_count,
            cancel_rate,
            completed_bookings,
            booking_duration,
            hour_category,
            is_weekend,
            zone_type
        ]]

        no_show_probability = predictor.predict_proba(input_data)[0] * 100
        logger.info(f"✅ Ймовірність no-show для {user_id}: {no_show_probability:.2f}%")

        response = jsonify({
            "userId": user_id,
            "prediction": bool(no_show_probability > 50),
            "noShowProbability": round(no_show_probability, 2)
        })
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 200

    except Exception as e:
        logger.exception(f"❌ Помилка обробки запиту no-show: {e}")
        response = jsonify({"error": "Internal server error"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

@app.route("/api/update-model", methods=["POST", "OPTIONS"])
def update_model():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    try:
        train_script = "prediction/noShow/train_random_forest.py"
        if not os.path.exists(train_script):
            logger.error(f"Training script {train_script} not found")
            return jsonify({"error": "Training script not found"}), 404
        result = subprocess.run(["python", train_script], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Training error: {result.stderr}")
            return jsonify({"error": f"Training error: {result.stderr}"}), 500
        global predictor
        predictor = NoShowPredictor(model_type="random_forest")
        model_path = "prediction/noShow/trained_models/model.pkl"
        scaler_path = "prediction/noShow/trained_models/scaler.pkl"
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            logger.error(f"Model {model_path} or scaler {scaler_path} not found after training")
            return jsonify({"error": "Model or scaler not found after training"}), 500
        predictor.load()
        logger.info("No-show model updated successfully")
        response = jsonify({"message": "No-show model updated"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 200
    except Exception as e:
        logger.error(f"Model update error: {str(e)}")
        response = jsonify({"error": str(e)})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

@app.route("/api/top-users-risk", methods=["GET", "OPTIONS"])
def top_users_risk():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    if not predictor or not predictor.is_trained:
        logger.error("No-show model not loaded")
        response = jsonify({"error": "Model not loaded"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

    try:
        users = collectionUsers.find()
        top_users = []

        for user in users:
            user_id = str(user["_id"])
            no_show_count = user.get("noShowCount", 0)
            cancel_count = user.get("cancelCount", 0)
            completed_bookings = sum(
                1 for d in collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id and b.get("status") == "completed"
            )
            cancel_rate = cancel_count / (completed_bookings + 1e-5) if completed_bookings else 0

            input_data = [[
                no_show_count,
                cancel_rate,
                completed_bookings,
                1.0,  # booking_duration (заглушка)
                1,    # hour_category (заглушка, 12–18 годин)
                0,    # is_weekend (заглушка, будній день)
                0     # zone_type (заглушка, Pro)
            ]]
            try:
                no_show_probability = predictor.predict_proba(input_data)[0] * 100
            except Exception as e:
                logger.error(f"Prediction error for {user_id}: {str(e)}")
                no_show_probability = 0
            top_users.append({
                "userId": user_id,
                "username": user.get("username", "No username"),
                "email": user.get("email", ""),
                "noShowProbability": round(no_show_probability, 2)
            })
        top_users.sort(key=lambda x: x["noShowProbability"], reverse=True)
        logger.info(f"Top users risk calculated, average no-show probability: {np.mean([u['noShowProbability'] for u in top_users]):.2f}%")
        response = jsonify({"topUsers": top_users[:5]})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 200
    except Exception as e:
        logger.error(f"Error calculating top users risk: {str(e)}")
        response = jsonify({"error": str(e)})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

@app.route("/api/no-show-stats", methods=["GET", "OPTIONS"])
def no_show_stats():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    if not predictor or not predictor.is_trained:
        logger.error("No-show model not loaded")
        response = jsonify({"error": "Model not loaded"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

    try:
        users = collectionUsers.find()
        probabilities = []
        user_data = []

        for user in users:
            user_id = str(user["_id"])
            no_show_count = user.get("noShowCount", 0)
            cancel_count = user.get("cancelCount", 0)
            completed_bookings = sum(
                1 for d in collection.find({"bookings.userId": user_id})
                for b in d.get("bookings", [])
                if b.get("userId") == user_id and b.get("status") == "completed"
            )
            cancel_rate = cancel_count / (completed_bookings + 1e-5) if completed_bookings else 0

            input_data = [[
                no_show_count,
                cancel_rate,
                completed_bookings,
                1.0,  # booking_duration (заглушка)
                1,    # hour_category (заглушка, 12–18 годин)
                0,    # is_weekend (заглушка, будній день)
                0     # zone_type (заглушка, Pro)
            ]]
            try:
                prob = predictor.predict_proba(input_data)[0] * 100
                probabilities.append(prob)
                user_data.append({
                    "userId": user_id,
                    "username": user.get("username", "Без імені"),
                    "email": user.get("email", "Немає email"),
                    "avatar": user.get("avatar", "https://via.placeholder.com/40"),
                    "isBlocked": user.get("isBlocked", False),
                    "noShowProbability": round(prob, 2),
                    "createdAt": user.get("createdAt", "2023-01-01T00:00:00Z"),
                    "totalBookings": sum(
                        1 for d in collection.find({"bookings.userId": user_id})
                        for b in d.get("bookings", [])
                        if b.get("userId") == user_id
                    ),
                    "completedBookings": completed_bookings,
                    "noShowCount": no_show_count,
                    "cancelCount": cancel_count,
                    "avgDurationHours": user.get("avgDurationHours", 0),
                    "bookings": [
                        {
                            "startTime": b.get("startTime", "2023-01-01T00:00:00Z"),
                            "endTime": b.get("endTime", "2023-01-01T01:00:00Z"),
                            "status": b.get("status", "unknown"),
                            "durationHours": b.get("durationHours", 1)
                        } for d in collection.find({"bookings.userId": user_id})
                        for b in d.get("bookings", [])
                        if b.get("userId") == user_id
                    ]
                })
            except Exception as e:
                logger.error(f"Prediction error for {user_id}: {str(e)}")
                continue

        bins = np.arange(0, 101, 10)
        hist, bin_edges = np.histogram(probabilities, bins=bins)
        distribution = [
            {
                "range": f"{int(bin_edges[i])}–{int(bin_edges[i+1])}%",
                "count": int(hist[i]),
                "users": [
                    u for u in user_data
                    if u["noShowProbability"] >= bin_edges[i] and u["noShowProbability"] < bin_edges[i+1]
                ]
            }
            for i in range(len(hist))
        ]

        stats_collection = db["noShowStats"]
        current_date = datetime.now(pytz.UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        last_record = stats_collection.find_one(
            {"timestamp": {"$gte": current_date, "$lt": current_date + timedelta(days=1)}},
            sort=[("timestamp", -1)]
        )
        should_save = True
        if last_record:
            last_distribution = last_record["distribution"]
            if all(
                last_dist["range"] == curr_dist["range"] and last_dist["count"] == curr_dist["count"]
                for last_dist, curr_dist in zip(last_distribution, distribution)
            ):
                logger.info("No-show distribution unchanged, skipping save")
                should_save = False
        if should_save:
            stats_collection.insert_one({
                "timestamp": datetime.now(pytz.UTC),
                "distribution": distribution,
                "totalUsers": len(probabilities)
            })

        history = list(stats_collection.find().sort("timestamp", -1).limit(30))
        history = [{
            "timestamp": h["timestamp"].isoformat(),
            "distribution": h["distribution"],
            "totalUsers": h["totalUsers"]
        } for h in history]

        logger.info(f"No-show stats calculated: {len(distribution)} ranges")
        response = jsonify({
            "currentDistribution": distribution,
            "history": history
        })
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 200
    except Exception as e:
        logger.error(f"Error calculating no-show stats: {str(e)}")
        response = jsonify({"error": str(e)})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

@app.route("/api/no-show-probability/<user_id>", methods=["GET", "OPTIONS"])
def no_show_probability(user_id):
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    if not predictor or not predictor.is_trained:
        logger.error("No-show model not loaded")
        response = jsonify({"error": "Model not loaded"})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500

    try:
        user = collectionUsers.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.error(f"User {user_id} not found")
            response = jsonify({"error": "User not found"})
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
            return response, 404

        no_show_count = user.get("noShowCount", 0)
        cancel_count = user.get("cancelCount", 0)
        completed_bookings = sum(
            1 for d in collection.find({"bookings.userId": user_id})
            for b in d.get("bookings", [])
            if b.get("userId") == user_id and b.get("status") == "completed"
        )
        cancel_rate = cancel_count / (completed_bookings + 1e-5) if completed_bookings else 0

        input_data = [[
            no_show_count,
            cancel_rate,
            completed_bookings,
            1.0,  # booking_duration (заглушка)
            1,    # hour_category (заглушка, 12–18 годин)
            0,    # is_weekend (заглушка, будній день)
            0     # zone_type (заглушка, Pro)
        ]]
        try:
            probability = predictor.predict_proba(input_data)[0]
            logger.info(f"Calculated no-show probability for user {user_id}: {probability*100:.2f}%")
            response = jsonify({"probability": probability})
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
            return response, 200
        except Exception as e:
            logger.error(f"Prediction error for {user_id}: {str(e)}")
            response = jsonify({"error": str(e)})
            response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
            return response, 500
    except Exception as e:
        logger.error(f"Error calculating no-show probability for {user_id}: {str(e)}")
        response = jsonify({"error": str(e)})
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        return response, 500
    
model = joblib.load("prediction/userKlasifaer/trained_models/user_activity_model.pkl")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "refidSC@gmail.com"
SMTP_PASSWORD = "mooa swrm svcv zfsd"

@app.route("/api/predict-user-activity-all", methods=["GET"])
def predict_user_activity_all():
    if not model:
        logger.error("User activity model not loaded")
        return jsonify({"error": "Model not loaded"}), 500

    try:
        users = list(collectionUsers.find({}))
        if not users:
            logger.warning("No users found")
            return jsonify({"error": "Users not found"}), 404

        features_list = []
        kiev_tz = pytz.timezone("Europe/Kyiv")
        current_kiev_time = datetime.now(kiev_tz)
        naive_kiev_time = current_kiev_time.replace(tzinfo=None)
        current_date_naive = naive_kiev_time.replace(hour=0, minute=0, second=0, microsecond=0)

        for user in users:
            user_id = str(user["_id"])
            created_at = user.get("createdAt", naive_kiev_time)
            if not isinstance(created_at, datetime):
                created_at = naive_kiev_time
            elif created_at.tzinfo is not None:
                created_at = created_at.astimezone(kiev_tz).replace(tzinfo=None)

            account_age_days = (naive_kiev_time - created_at).days

            bookings = []
            for device in collection.find({"bookings.userId": user_id}):
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
                ) / total_bookings if total_bookings > 0 else 0
            )

            completed_ratio = completed_bookings / total_bookings if total_bookings > 0 else 0
            booking_frequency = total_bookings / account_age_days * 30 if account_age_days > 0 else 0

            last_booking = max(
                (b["startTime"] for b in bookings if isinstance(b["startTime"], datetime)),
                default=naive_kiev_time - timedelta(days=365)
            )
            if last_booking.tzinfo is not None:
                last_booking = last_booking.astimezone(kiev_tz).replace(tzinfo=None)
            days_since_last_booking = (naive_kiev_time - last_booking).days

            features_list.append({
                "userId": user_id,
                "username": user.get("username", "No username"),
                "email": user.get("email", ""),
                "avatar": user.get("avatar", ""),
                "totalBookings": total_bookings,
                "noShowCount": no_show_count,
                "cancelCount": cancel_count,
                "daysSinceLastBooking": days_since_last_booking,
                "accountAgeDays": account_age_days,
                "avgDuration": avg_duration,
                "completed_ratio": completed_ratio,
                "booking_frequency": booking_frequency
            })

        df = pd.DataFrame(features_list)
        feature_columns = [
            "totalBookings", "noShowCount", "cancelCount", "daysSinceLastBooking",
            "accountAgeDays", "avgDuration", "completed_ratio", "booking_frequency"
        ]

        X = df[feature_columns].copy()
        X.fillna({
            "daysSinceLastBooking": X["daysSinceLastBooking"].mean(),
            "accountAgeDays": X["accountAgeDays"].mean(),
            "avgDuration": 0,
            "completed_ratio": 0,
            "booking_frequency": 0
        }, inplace=True)

        predictions = model.predict(X)
        activity_counts = {"active": 0, "passive": 0, "new": 0, "at_risk": 0}
        for pred in predictions:
            activity_counts[pred] += 1

        last_record = activity_history_collection.find_one(
            {
                "date": {
                    "$gte": current_date_naive,
                    "$lt": current_date_naive + timedelta(days=1)
                }
            },
            sort=[("date", -1)]
        )

        should_save = True
        if last_record:
            last_distribution = last_record["distribution"]
            if (
                last_distribution["active"] == activity_counts["active"] and
                last_distribution["passive"] == activity_counts["passive"] and
                last_distribution["new"] == activity_counts["new"] and
                last_distribution["at_risk"] == activity_counts["at_risk"]
            ):
                logger.info("User activity distribution unchanged, skipping save")
                should_save = False

        if should_save:
            activity_history_collection.update_one(
                {
                    "date": {
                        "$gte": current_date_naive,
                        "$lt": current_date_naive + timedelta(days=1)
                    }
                },
                {
                    "$set": {
                        "date": naive_kiev_time,
                        "distribution": activity_counts
                    }
                },
                upsert=True
            )
            logger.info(f"✅ User activity saved at local time: {naive_kiev_time}")

        result = [
            {
                "user": {
                    "userId": row["userId"],
                    "userActivity": pred,
                    "username": row["username"],
                    "email": row["email"],
                    "avatar": row["avatar"],
                    "totalBookings": row["totalBookings"],
                    "noShowCount": row["noShowCount"],
                    "cancelCount": row["cancelCount"],
                    "avgDuration": row["avgDuration"]
                }
            }
            for _, row, pred in zip(range(len(df)), df.to_dict("records"), predictions)
        ]

        logger.info("✅ User activity prediction completed")
        return jsonify(result)

    except Exception as e:
        logger.error(f"❌ User activity prediction error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/send-message", methods=["POST", "OPTIONS"])
def send_message():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, role"
        return response, 200

    try:
        data = request.get_json()
        emails = data.get("emails", [])
        subject = data.get("subject", "")
        message = data.get("message", "")
        top_users_risk = data.get("topUsersRisk", False)

        if top_users_risk:
            users = collectionUsers.find()
            top_users = []
            future_time = datetime.now(pytz.UTC) + timedelta(hours=1)
            default_zone = "Pro"
            zone_type = {"Pro": 0, "VIP": 1, "PS": 2}.get(default_zone, 0)
            now = datetime.now(pytz.UTC)
            lead_time = (future_time - now).total_seconds() / 3600
            day_of_week = future_time.weekday()
            hour_of_day = future_time.hour

            for user in users:
                user_id = str(user["_id"])
                no_show_count = user.get("noShowCount", 0)
                cancel_count = user.get("cancelCount", 0)
                input_data = [[no_show_count, cancel_count, lead_time, day_of_week, hour_of_day, zone_type]]
                try:
                    no_show_probability = predictor.predict_proba(input_data)[0]
                except Exception as e:
                    logger.error(f"Prediction error for {user_id}: {str(e)}")
                    no_show_probability = 0
                top_users.append({
                    "userId": user_id,
                    "username": user.get("username", "No username"),
                    "email": user.get("email", ""),
                    "noShowProbability": round(no_show_probability * 100, 2)
                })
            top_users.sort(key=lambda x: x["noShowProbability"], reverse=True)
            emails = [user["email"] for user in top_users[:5] if user["email"]]
            logger.info(f"Selected {len(emails)} emails for top risk users")

        if not emails or not subject or not message:
            logger.warning("Missing required parameters")
            return jsonify({"error": "Missing required parameters"}), 400

        valid_emails = [email for email in emails if re.match(r"[^@]+@[^@]+\.[^@]+", email)]
        if not valid_emails:
            logger.error("No valid email addresses")
            return jsonify({"error": "No valid email addresses provided"}), 400

        sent_emails = []
        for email in valid_emails:
            user = collectionUsers.find_one({"email": email})
            username = user.get("username", "Користувач") if user else "Користувач"
            no_show_probability = next((u["noShowProbability"] for u in top_users if u["email"] == email), 0) if top_users_risk else 0

            html_content = f"""
            <html>
                <body>
                    <h2>Вітаємо, {username}!</h2>
                    <p>{message}</p>
                    {'<p>Ваш ризик неявки становить ' + str(no_show_probability) + '%. Будь ласка, підтвердіть вашу явку.</p>' if top_users_risk and no_show_probability > 0 else ''}
                    <p>З повагою,<br>Команда комп'ютерного клубу</p>
                </body>
            </html>
            """
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_USERNAME
            msg["To"] = email
            msg.attach(MIMEText(message, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            try:
                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                    server.starttls()
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(msg)
                sent_emails.append(email)
            except Exception as e:
                logger.error(f"Error sending email to {email}: {str(e)}")

        if not sent_emails:
            logger.error("No emails sent")
            return jsonify({"error": "Failed to send any emails"}), 500
        logger.info(f"Emails sent to {len(sent_emails)} recipients")
        return jsonify({"message": f"Emails sent successfully to {len(sent_emails)} recipients"})
    except Exception as e:
        logger.error(f"Email sending error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/user-details/<user_id>", methods=["GET"])
def get_user_details(user_id):
    try:
        user = collectionUsers.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning(f"User {user_id} not found")
            return jsonify({"error": "User not found"}), 404

        bookings = []
        for device in collection.find({"bookings.userId": user_id}):
            for booking in device["bookings"]:
                if booking["userId"] == user_id:
                    bookings.append({
                        "startTime": booking["startTime"].isoformat(),
                        "endTime": booking["endTime"].isoformat(),
                        "status": booking["status"],
                        "durationHours": (booking["endTime"] - booking["startTime"]).total_seconds() / 3600
                    })

        total_bookings = len(bookings)
        completed_bookings = sum(1 for b in bookings if b["status"] == "completed")
        no_show_count = sum(1 for b in bookings if b["status"] == "noShow")
        cancel_count = sum(1 for b in bookings if b["status"] == "cancelled")
        avg_duration = sum(b["durationHours"] for b in bookings) / total_bookings if total_bookings > 0 else 0

        response = {
            "userId": user_id,
            "username": user.get("username", "No username"),
            "email": user.get("email", ""),
            "createdAt": user.get("createdAt", "").isoformat() if user.get("createdAt") else "",
            "totalBookings": total_bookings,
            "completedBookings": completed_bookings,
            "noShowCount": no_show_count,
            "cancelCount": cancel_count,
            "avgDurationHours": round(avg_duration, 2),
            "bookings": bookings
        }
        logger.info(f"User details retrieved for {user_id}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error retrieving user details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/activity-trends", methods=["GET"])
def get_activity_trends():
    try:
        now = datetime.now(pytz.UTC)
        from_dt = (now - timedelta(days=15)).replace(hour=0, minute=0, second=0, microsecond=0)
        to_dt = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        raw_trends = list(activity_history_collection.find({
            "date": {"$gte": from_dt, "$lte": to_dt}
        }).sort("date", 1))

        trends_by_day = {}
        for t in raw_trends:
            day_str = t["date"].strftime("%Y-%m-%d")
            trends_by_day[day_str] = t  # залишає останній запис цього дня

        response = [
            {
                "date": day,
                "active": t["distribution"]["active"],
                "passive": t["distribution"]["passive"],
                "new": t["distribution"]["new"],
                "at_risk": t["distribution"]["at_risk"]
            }
            for day, t in sorted(trends_by_day.items())
        ]

        logger.info("✅ Activity trends retrieved successfully")
        return jsonify(response)

    except Exception as e:
        logger.error(f"❌ Error retrieving activity trends: {str(e)}")
        return jsonify({"error": str(e)}), 500


from apscheduler.schedulers.background import BackgroundScheduler

def check_expired_discounts():
    current_datetime = kiev_tz.localize(datetime.now())
    current_time = current_datetime.time()
    expired_discounts = db.discounts.find({
        "endDate": {"$lt": current_datetime.isoformat()}  # Фільтр для закінчених акцій
    })

    for discount in expired_discounts:
        end_date = pd.to_datetime(discount["endDate"]).astimezone(kiev_tz)
        logger.debug(f"Checking discount for zone {discount['zone']}: end_date={end_date}, current_datetime={current_datetime}")

        is_expired = end_date < current_datetime

        if 'specificPeriod' in discount and discount['specificPeriod'] and current_datetime.date() == end_date.date():
            start_time_str, end_time_str = map(str.strip, discount['specificPeriod'].split('-'))
            start_period = datetime.strptime(start_time_str, "%H:%M").time()
            end_period = datetime.strptime(end_time_str, "%H:%M").time()
            if not (start_period <= current_time <= end_period):
                is_expired = True
                logger.info(f"Discount for zone {discount['zone']} expired due to specificPeriod {discount['specificPeriod']}")

        if is_expired:
            db.discounts.delete_one({"_id": discount["_id"]})
            logger.info(f"Deleted expired discount for zone {discount['zone']}")

# Ініціалізація планувальника
scheduler = BackgroundScheduler()
scheduler.add_job(check_expired_discounts, 'interval', minutes=1)  # Перевірка кожну хвилину
scheduler.start()

# Додайте до вашого __main__
if __name__ == '__main__':
    try:
        # Виклик check_expired_discounts один раз при старті для ініціалізації
        check_expired_discounts()
        app.run(host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        scheduler.shutdown()