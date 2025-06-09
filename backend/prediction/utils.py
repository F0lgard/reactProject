# utils.py

from pymongo import MongoClient
import os
import datetime
import pandas as pd

def get_bookings_from_db():
    """
    Отримує пристрої з бронюваннями з БД та повертає список об'єктів з очищеними даними.
    """
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    client = MongoClient(uri)
    db = client["your_database_name"]
    collection = db["devices"]
    devices = list(collection.find())

    cleaned_data = []

    for device in devices:
        zone = device.get("zone")
        bookings = device.get("bookings", [])
        
        if not zone or not isinstance(bookings, list):
            continue

        valid_bookings = []
        for booking in bookings:
            start_time = booking.get("startTime")
            if not start_time:
                continue

            # Спроба перетворити на datetime
            try:
                if isinstance(start_time, str):
                    start_time = pd.to_datetime(start_time)
            except Exception:
                continue

            # Перевірка: чи все ще валідна дата
            if not isinstance(start_time, pd.Timestamp):
                continue

            valid_bookings.append({
                "startTime": start_time
            })

        # Якщо є хоч одне валідне бронювання — додаємо
        if valid_bookings:
            cleaned_data.append({
                "zone": zone,
                "bookings": valid_bookings
            })

    return cleaned_data
