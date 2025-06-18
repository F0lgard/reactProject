# utils.py

from pymongo import MongoClient
import os
import datetime
import pandas as pd

def get_bookings_from_db():
    """
    Отримує пристрої з бронюваннями з БД та повертає список об'єктів з очищеними даними.
    """
    client = MongoClient("mongodb://localhost:27017/")
    db = client["computerClub"]
    collection = db["devices"]
    devices = list(collection.find())

    print(f"📋 Дані з MongoDB: {len(devices)} пристроїв")  # Логування кількості пристроїв

    cleaned_data = []

    for device in devices:
        zone = device.get("zone")
        bookings = device.get("bookings", [])
        
        if not zone or not isinstance(bookings, list):
            print(f"❌ Пристрій виключено: zone={zone}, bookings={bookings}")
            continue

        valid_bookings = []
        for booking in bookings:
            start_time = booking.get("startTime")
            if not start_time:
                print(f"❌ Бронювання виключено: startTime={start_time}")
                continue

            # Перевірка формату startTime
            if isinstance(start_time, dict) and "$date" in start_time:
                try:
                    start_time = pd.to_datetime(start_time["$date"])
                except Exception as e:
                    print(f"❌ Помилка перетворення startTime: {e}")
                    continue
            elif isinstance(start_time, str):
                try:
                    start_time = pd.to_datetime(start_time)
                except Exception as e:
                    print(f"❌ Помилка перетворення startTime: {e}")
                    continue
            elif not isinstance(start_time, (datetime.datetime, pd.Timestamp)):
                print(f"❌ Бронювання виключено: startTime не валідний {start_time}")
                continue

            valid_bookings.append(booking)  # Повертаємо весь об’єкт бронювання

        # Якщо є хоч одне валідне бронювання — додаємо
        if valid_bookings:
            cleaned_data.append({
                "zone": zone,
                "bookings": valid_bookings
            })
        else:
            print(f"❌ Пристрій виключено через відсутність валідних бронювань: {device}")

    print(f"📋 Очищені дані: {len(cleaned_data)} пристроїв з бронюваннями")  # Логування очищених даних
    return cleaned_data