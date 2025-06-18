from pymongo import MongoClient
from datetime import datetime, timedelta
import pytz
import random

client = MongoClient("mongodb://localhost:27017/")
db = client["computerClub"]
activity_history_collection = db["activity_history"]

# Очистка попередніх даних
activity_history_collection.delete_many({})

# Генерація даних за травень 2025
start_date = datetime(2025, 5, 1, tzinfo=pytz.UTC)
end_date = datetime(2025, 5, 31, tzinfo=pytz.UTC)
current_date = start_date

while current_date <= end_date:
    distribution = {
        "active": random.randint(40, 60),
        "passive": random.randint(20, 35),
        "new": random.randint(5, 15),
        "at_risk": random.randint(5, 20)
    }
    activity_history_collection.insert_one({
        "date": current_date,
        "distribution": distribution
    })
    current_date += timedelta(days=1)

print("Дані за травень 2025 додано до activity_history")