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
    predict_end += timedelta(days=1) - timedelta(seconds=1)
    future_hours = pd.date_range(start=predict_start, end=predict_end, freq='h')
    rows = []
    for hour in future_hours:
        if 8 <= hour.hour < 24:
            for zone in ['Pro', 'VIP', 'PS']:
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
    zone_encoded = encoder.transform(df[["zone"]].values)
    zone_cols = encoder.get_feature_names_out(["zone"])
    df_encoded = pd.concat([df.drop(columns=["zone", "date"]), pd.DataFrame(zone_encoded, columns=zone_cols)], axis=1)
    X_pred = df_encoded[["hour", "dayOfWeek", "isWeekend", "month"] + list(zone_cols)]
    predictions = model.predict(X_pred)
    df["predicted_bookings"] = np.round(predictions).astype(int)
    # Обрізаємо мінусові та NaN
    df["predicted_bookings"] = df["predicted_bookings"].apply(lambda x: max(0, x) if pd.notnull(x) else 0)

    print(f"📊 Прогнозовані дані: {df}")
    return df

def train_and_predict(train_from, train_to, predict_from, predict_to, use_all=False):
    """
    Об'єднана функція: вивантажує дані, навчає модель і повертає прогноз із рекомендаціями.
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

    recommendations = []

    # Якщо прогноз на один день
    if predict_start.date() == predict_end.date():
        hourly_data = result_df.groupby("hour")["predicted_bookings"].sum().reset_index()
        avg_hourly_load = hourly_data["predicted_bookings"].mean()
        min_hourly_load = hourly_data["predicted_bookings"].min()
        threshold = avg_hourly_load * 0.7

        def get_discount(load, avg, min_):
            # Чим ближче до мінімального, тим більша знижка
            if load <= min_ + 0.1 * (avg - min_):
                return 40
            elif load <= min_ + 0.3 * (avg - min_):
                return 25
            elif load <= min_ + 0.5 * (avg - min_):
                return 15
            elif load <= threshold:
                return 10
            else:
                return 5

        low_hours = []
        for hour, bookings in zip(hourly_data["hour"], hourly_data["predicted_bookings"]):
            if bookings <= threshold:
                low_hours.append((hour, bookings))
            elif low_hours:
                if len(low_hours) >= 2:
                    start_hour = low_hours[0][0]
                    end_hour = low_hours[-1][0] + 1
                    min_load = min([b for _, b in low_hours])
                    discount = get_discount(min_load, avg_hourly_load, min_hourly_load)
                    recommendations.append({
                        "date": predict_start.strftime("%Y-%m-%d"),
                        "period": f"{start_hour}:00 - {end_hour}:00",
                        "recommendation": f"Очікується низьке завантаження (середнє: {avg_hourly_load:.0f} бронювань, найменше: {min_hourly_load} бронювань). Рекомендується акція -{discount}% на період {start_hour}:00 - {end_hour}:00."
                    })
                low_hours = []

        if low_hours and len(low_hours) >= 2:
            start_hour = low_hours[0][0]
            end_hour = low_hours[-1][0] + 1
            min_load = min([b for _, b in low_hours])
            discount = get_discount(min_load, avg_hourly_load, min_hourly_load)
            recommendations.append({
                "date": predict_start.strftime("%Y-%m-%d"),
                "period": f"{start_hour}:00 - {end_hour}:00",
                "recommendation": f"Очікується низьке завантаження (середнє: {avg_hourly_load:.0f} бронювань, найменше: {min_hourly_load} бронювань). Рекомендується акція -{discount}% на період {start_hour}:00 - {end_hour}:00."
            })

    # Якщо прогноз на кілька днів
    else:
        daily_data = result_df.groupby(result_df["date"].str.split(" ").str[0])["predicted_bookings"].sum().reset_index()
        daily_data.rename(columns={"date": "day", "predicted_bookings": "total_bookings"}, inplace=True)
        avg_daily_load = daily_data["total_bookings"].mean()
        min_daily_load = daily_data["total_bookings"].min()
        threshold = avg_daily_load * 0.7

        def get_discount(load, avg, min_):
            if load <= min_ + 0.1 * (avg - min_):
                return 40
            elif load <= min_ + 0.3 * (avg - min_):
                return 25
            elif load <= min_ + 0.5 * (avg - min_):
                return 15
            elif load <= threshold:
                return 10
            else:
                return 5

        low_days = daily_data[daily_data["total_bookings"] <= threshold]
        for _, row in low_days.iterrows():
            discount = get_discount(row["total_bookings"], avg_daily_load, min_daily_load)
            recommendations.append({
                "date": row["day"],
                "recommendation": f"Очікується низьке завантаження (середнє: {avg_daily_load:.0f} бронювань, найменше: {min_daily_load} бронювань). Рекомендується акція -{discount}% на весь день."
            })

    # Додаємо рекомендації до результатів
    result_df["recommendation"] = result_df.apply(
        lambda row: next(
            (r["recommendation"] for r in recommendations if r["date"].split(" ")[0] == row["date"].split(" ")[0]),
            None
        ),
        axis=1
    )

    print(f"📊 Прогнозовані дані з рекомендаціями: {result_df}")
    return {
        "predictions": result_df.to_dict(orient="records"),
        "recommendations": recommendations
    }