import random
import json
from datetime import datetime, timedelta

# Читання даних із файлу computerClub.devices.json
with open("computerClub.devices.json", "r", encoding="utf-8") as f:
    devices = json.load(f)

# Список користувачів (унікальні userId і email)
users = {}
for device in devices:
    for booking in device["bookings"]:
        users[booking["userId"]] = booking["userEmail"]

# Популярність пристроїв (вищий коефіцієнт = популярніший)
device_popularity = {
    "ПК1P": 0.9, "ПК2P": 0.7, "ПК3P": 0.6, "ПК4P": 0.4, "ПК5P": 0.8,
    "ПК6P": 0.5, "ПК7P": 0.6, "ПК8P": 0.7, "ПК9P": 0.6, "ПК10P": 0.5,
    "ПК11P": 0.3, "ПК12P": 0.2, "ПК1V": 0.8, "ПК2V": 0.7, "ПК3V": 0.6,
    "ПК4V": 0.5, "ПК5V": 0.7, "ПК6V": 0.6, "ПК7V": 0.7, "ПК8V": 0.5,
    "PS1": 0.4, "PS2": 0.3, "PS3": 0.3, "PS4": 0.5
}

# Ціни залежно від зони та тривалості (у годинах)
price_schedules = {
    "Pro": {1: 80, 3: 225, 5: 350, 7: 450},
    "VIP": {1: 120, 3: 350, 5: 550, 7: 700},
    "PS": {1: 200, 3: 500, 5: 700, 7: 800}
}

# Генерація бронювань за травень 2025
start_date = datetime(2025, 5, 1)
end_date = datetime(2025, 5, 31)
generated_bookings = []

current_bookings = {device["_id"]["$oid"]: [] for device in devices}  # Відстеження зайнятих слотів

# Допоміжна функція для конвертації $date у datetime
def parse_datetime(date_dict):
    date_str = date_dict["$date"]
    try:
        # Спроба з мікросекундами
        return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        # Якщо немає мікросекунд
        return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")

def is_slot_available(device_id, start_time, end_time):
    bookings = current_bookings[device_id]
    for booking in bookings:
        booking_start = parse_datetime(booking["startTime"])
        booking_end = parse_datetime(booking["endTime"])
        if not (end_time <= booking_start or start_time >= booking_end):
            return False
    return True

def generate_realistic_booking(device):
    device_id = device["_id"]["$oid"]
    base_date = start_date + timedelta(days=random.randint(0, 30))
    hour = random.randint(8, 23)  # 8:00 - 23:00 (обмеження до 24:00)
    duration_hours = random.choice([1, 3, 5, 7])  # Тільки дозволені тривалості
    start_time = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=duration_hours)

    # Перевірка, щоб end_time не перевищував 24:00
    if end_time.hour > 24 or end_time.hour == 24 and end_time.minute > 0:
        excess = (end_time - datetime(end_time.year, end_time.month, end_time.day, 23, 59, 59)).total_seconds() / 3600
        duration_hours -= int(excess) + 1
        if duration_hours < 1:
            return None
        end_time = start_time + timedelta(hours=duration_hours)

    # Реалістичний розподіл: менше вранці, більше ввечері, піки в середині тижня
    day_of_week = start_time.weekday()
    time_weight = 1.0
    if hour < 12:
        time_weight *= 0.5  # Менше вранці
    elif hour >= 18:
        time_weight *= 1.5  # Більше ввечері
    if day_of_week in [5, 6]:  # Субота, неділя
        time_weight *= 1.2
    elif day_of_week in [2, 3, 4]:  # Середа-п’ятниця
        time_weight *= 1.3

    # Додаємо вагу популярності пристрою
    popularity_weight = device_popularity[device["id"]]
    total_weight = time_weight * popularity_weight

    if random.random() > total_weight:  # Шанс створення бронювання
        return None

    if not is_slot_available(device_id, start_time, end_time):
        return None

    user_id = random.choice(list(users.keys()))
    price = price_schedules[device["zone"]][duration_hours]

    booking = {
        "userId": user_id,
        "userEmail": users[user_id],
        "startTime": {"$date": start_time.isoformat() + "Z"},
        "endTime": {"$date": end_time.isoformat() + "Z"},
        "price": price,
        "_id": {"$oid": f"68{random.randint(1000000000000000, 9999999999999999):016d}"}
    }
    current_bookings[device_id].append(booking)
    return booking

# Генерація 250 бронювань (регулюй кількість за потребою)
for _ in range(250):
    device = random.choice(devices)
    booking = generate_realistic_booking(device)
    if booking:
        for d in devices:
            if d["_id"]["$oid"] == device["_id"]["$oid"]:
                d["bookings"].append(booking)
                break

# Вихідний JSON
output = {
    "devices": devices,
    "__v": sum(len(d["bookings"]) for d in devices)
}

with open("generated_may_bookings_realistic.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("Дані згенеровано у файл generated_may_bookings_realistic.json")