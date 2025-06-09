# model.py

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from .utils import get_bookings_from_db


def prepare_data(bookings, start_date=None, end_date=None):
    """
    Обробка сирих даних з БД для навчання моделі.
    Якщо не вказано період, беруться всі дані.
    """
    rows = []

    for booking in bookings:
        zone = booking.get("zone")
        for record in booking.get("bookings", []):
            start_time = record.get("startTime")

            if isinstance(start_time, str):
                start_time = pd.to_datetime(start_time)

            if start_time and (not start_date or start_time >= start_date) and (not end_date or start_time <= end_date):
                rows.append({
                    "hour": start_time.hour,
                    "dayOfWeek": start_time.weekday(),
                    "isWeekend": int(start_time.weekday() >= 5),
                    "zone": zone,
                    "bookings": 1
                })

    df = pd.DataFrame(rows)
    return df


def train_model(df):
    """
    Навчає модель RandomForest на підготовлених даних.
    """
    if df.empty:
        raise ValueError("Порожній датафрейм — недостатньо даних для навчання")

    # Кодування категорій
    encoder = OneHotEncoder(sparse=False)
    zone_encoded = encoder.fit_transform(df[["zone"]])
    zone_cols = encoder.get_feature_names_out(["zone"])
    df_encoded = pd.concat([
        df.drop(columns=["zone"]),
        pd.DataFrame(zone_encoded, columns=zone_cols)
    ], axis=1)

    X = df_encoded.drop(columns=["bookings"])
    y = df_encoded["bookings"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    print(f"📊 RMSE моделі: {rmse:.2f} бронювань")

    return model, encoder


def predict_load(model, encoder, target_start, target_end):
    """
    Прогнозує завантаження по годинах і зонах на вказаний період.
    """
    future_days = pd.date_range(start=target_start, end=target_end, freq='D')
    rows = []
    for day in future_days:
        for hour in range(8, 24):
            for zone in ['Pro', 'VIP', 'PS']:
                rows.append({
                    "hour": hour,
                    "dayOfWeek": day.weekday(),
                    "isWeekend": int(day.weekday() >= 5),
                    "zone": zone,
                    "date": day.strftime("%Y-%m-%d")
                })

    df = pd.DataFrame(rows)
    zone_encoded = encoder.transform(df[["zone"]])
    zone_cols = encoder.get_feature_names_out(["zone"])
    df_encoded = pd.concat([df, pd.DataFrame(zone_encoded, columns=zone_cols)], axis=1)
    X_pred = df_encoded[["hour", "dayOfWeek", "isWeekend"] + list(zone_cols)]
    predictions = model.predict(X_pred)
    df["predicted_bookings"] = np.round(predictions).astype(int)

    return df


def train_and_predict(train_from, train_to, predict_from, predict_to, use_all=False):
    """
    Об'єднана функція: вивантажує дані, навчає модель і повертає прогноз.
    """
    from datetime import datetime
    train_start = pd.to_datetime(train_from) if train_from else None
    train_end = pd.to_datetime(train_to) if train_to else None
    predict_start = pd.to_datetime(predict_from)
    predict_end = pd.to_datetime(predict_to)

    bookings = get_bookings_from_db()
    df = prepare_data(bookings, None if use_all else train_start, None if use_all else train_end)
    model, encoder = train_model(df)
    result_df = predict_load(model, encoder, predict_start, predict_end)
    return result_df.to_dict(orient="records")
