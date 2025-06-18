import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor
from .utils import get_bookings_from_db
from datetime import datetime, timedelta

def prepare_data(bookings, start_date=None, end_date=None):
    """
    Обробка сирих даних з БД для навчання моделі з агрегацією.
    """
    rows = []
    print(f"📋 Вхідні дані для обробки: {len(bookings)} пристроїв з бронюваннями")
    print(f"📅 Період навчання: start_date={start_date}, end_date={end_date}")

    for device in bookings:
        zone = device.get("zone")
        for booking in device.get("bookings", []):
            start_time = booking.get("startTime")
            if isinstance(start_time, dict) and "$date" in start_time:
                start_time = pd.to_datetime(start_time["$date"])
            elif isinstance(start_time, str):
                start_time = pd.to_datetime(start_time)
            elif isinstance(start_time, (pd.Timestamp, datetime)):
                pass
            else:
                print(f"❌ Пропущено бронювання через невалідний startTime: {start_time}")
                continue

            # Фільтрація за періодом (включно з кінцем дня)
            if start_date and end_date:
                start_date_dt = pd.to_datetime(start_date)
                end_date_dt = pd.to_datetime(end_date) + timedelta(days=1) - timedelta(seconds=1)  # До 23:59:59
                if not (start_date_dt <= start_time <= end_date_dt):
                    print(f"⏭ Пропущено бронювання через період: {start_time}")
                    continue

            rows.append({
                "hour": start_time.hour,
                "dayOfWeek": start_time.weekday(),
                "isWeekend": int(start_time.weekday() >= 5),
                "month": start_time.month,
                "zone": zone
            })

    if not rows:
        raise ValueError("Немає даних для обробки в заданому періоді")

    # Агрегація кількості бронювань за унікальними комбінаціями
    df = pd.DataFrame(rows)
    df_aggregated = df.groupby(["hour", "dayOfWeek", "isWeekend", "month", "zone"]).size().reset_index(name="bookings")
    print(f"📊 Підготовлений датафрейм: {df_aggregated.shape[0]} записів з унікальними комбінаціями")
    return df_aggregated

def train_model(df):
    """
    Навчає модель XGBoost на підготовлених даних.
    """
    if df.empty:
        raise ValueError("Порожній датафрейм — недостатньо даних для навчання")

    # Кодування категорій із усіма можливими зонами
    all_zones = ['Pro', 'VIP', 'PS']  # Визначаємо всі можливі зони
    encoder = OneHotEncoder(sparse=False, drop='first', categories=[all_zones])
    zone_encoded = encoder.fit_transform(df[["zone"]])
    zone_cols = encoder.get_feature_names_out(["zone"])
    df_encoded = pd.concat([
        df.drop(columns=["zone", "bookings"]),
        pd.DataFrame(zone_encoded, columns=zone_cols),
        df["bookings"]
    ], axis=1)

    X = df_encoded.drop(columns=["bookings"])
    y = df_encoded["bookings"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    print(f"📊 RMSE моделі: {rmse:.2f} бронювань")

    return model, encoder

def predict_load(model, encoder, target_start, target_end):
    """
    Прогнозує завантаження по годинах і зонах на весь заданий період, включаючи останній день.
    """
    predict_start = pd.to_datetime(target_start)
    predict_end = pd.to_datetime(target_end)
    # Додаємо один день до кінця, щоб включити весь період
    predict_end += timedelta(days=1) - timedelta(seconds=1)  # До 23:59:59 останнього дня
    future_hours = pd.date_range(start=predict_start, end=predict_end, freq='h')
    rows = []
    for hour in future_hours:
        if 8 <= hour.hour < 24:  # Обмеження з 8:00 до 24:00
            for zone in ['Pro', 'VIP', 'PS']:  # Використовуємо всі зони
                rows.append({
                    "hour": hour.hour,
                    "dayOfWeek": hour.weekday(),
                    "isWeekend": int(hour.weekday() >= 5),
                    "month": hour.month,
                    "zone": zone,
                    "date": hour.strftime("%Y-%m-%d %H:00")
                })

    if not rows:
        raise ValueError("Немає даних для прогнозу в заданому періоді")

    df = pd.DataFrame(rows)
    print(f"📊 Початковий датафрейм для прогнозу: {df.shape[0]} рядків")
    # Додаємо обробку невідомих категорій
    zone_encoded = encoder.transform(df[["zone"]].values)
    zone_cols = encoder.get_feature_names_out(["zone"])
    df_encoded = pd.concat([df.drop(columns=["zone", "date"]), pd.DataFrame(zone_encoded, columns=zone_cols)], axis=1)
    X_pred = df_encoded[["hour", "dayOfWeek", "isWeekend", "month"] + list(zone_cols)]
    predictions = model.predict(X_pred)
    df["predicted_bookings"] = np.round(predictions).astype(int)

    print(f"📊 Прогнозовані дані: {df}")
    return df

def train_and_predict(train_from, train_to, predict_from, predict_to, use_all=False):
    """
    Об'єднана функція: вивантажує дані, навчає модель і повертає прогноз.
    """
    print(f"📥 Отримані параметри: train_from={train_from}, train_to={train_to}, predict_from={predict_from}, predict_to={predict_to}, use_all={use_all}")
    train_start = pd.to_datetime(train_from) if train_from else None
    train_end = pd.to_datetime(train_to) if train_to else None
    predict_start = pd.to_datetime(predict_from)
    predict_end = pd.to_datetime(predict_to)

    bookings = get_bookings_from_db()
    df = prepare_data(bookings, train_start, train_end)
    model, encoder = train_model(df)
    result_df = predict_load(model, encoder, predict_start, predict_end)
    return result_df.to_dict(orient="records")