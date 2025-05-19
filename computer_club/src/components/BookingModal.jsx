import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import "../styles/Modal.css";
import { useAuth } from "./AuthContext";
import { useBookings } from "./BookingsContext";
import axios from "axios";

const priceTable = {
  Pro: { 1: 80, 3: 225, 5: 350, 7: 450 },
  VIP: { 1: 120, 3: 350, 5: 550, 7: 700 },
  PS: { 1: 200, 3: 500 },
};

const MIN_HOUR = 8;
const MAX_HOUR = 24;

// Функція для отримання локальної дати
const getLocalDateString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const BookingModal = ({ isActive, onClose, selectedDevice, fetchDevices }) => {
  const { user } = useAuth();
  const { addBooking } = useBookings();
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [bookingError, setBookingError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [price, setPrice] = useState(0);
  const [currentDate, setCurrentDate] = useState(getLocalDateString());

  // Оновлення дати кожну хвилину
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(getLocalDateString());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      console.log("Selected Device Bookings:", selectedDevice.bookings);

      // Отримуємо поточний час у UTC
      const nowUTC = new Date(Date.now()); // Використовуємо Date.now() для точного часу

      const filteredBookings = (selectedDevice.bookings || []).filter(
        (booking) => {
          const bookingEndTime = new Date(booking.endTime); // Час завершення бронювання в UTC
          console.log("Booking End Time (UTC):", bookingEndTime.toISOString());
          console.log("Current Time (UTC):", nowUTC.toISOString());

          // Ігноруємо бронювання, які завершилися
          if (bookingEndTime <= nowUTC) {
            console.log("✅ Це бронювання вже завершилось, пропускаємо");
            return false;
          }

          return true; // Додаємо тільки активні бронювання
        }
      );

      console.log("Filtered Bookings (Active):", filteredBookings);
      setBookings(filteredBookings); // Оновлюємо стан
      console.log("Updated Bookings State:", filteredBookings);
    }
  }, [selectedDevice, currentDate]);

  useEffect(() => {
    if (isActive) {
      const now = new Date();

      // Створюємо локальний час без UTC корекції
      let targetTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes()
      );

      if (targetTime.getHours() < MIN_HOUR) {
        targetTime = new Date(
          targetTime.getFullYear(),
          targetTime.getMonth(),
          targetTime.getDate(),
          MIN_HOUR,
          0,
          0
        );
      } else {
        targetTime.setMinutes(targetTime.getMinutes() + 10); // Додаємо мінімум 10 хвилин
      }

      // Форматуємо в ISO рядок
      const timeString = `${String(targetTime.getHours()).padStart(
        2,
        "0"
      )}:${String(targetTime.getMinutes()).padStart(2, "0")}`;
      const localISOTime = `${currentDate}T${timeString}`;
      setStartTime(localISOTime); // Встановлюємо час бронювання в локальному форматі
    }
  }, [isActive, currentDate]);

  const checkTimeConflict = (newStartTime, newDuration) => {
    if (!selectedDevice) return;

    // Час початку бронювання (локальний)
    const localStart = new Date(`${currentDate}T${newStartTime}`);
    const localEnd = new Date(localStart.getTime() + newDuration * 3600000); // Додаємо тривалість у години

    // Поточний локальний час
    const now = new Date();

    console.log("📌 Поточний час:", now.toLocaleString());
    console.log("⏳ Початок бронювання:", localStart.toLocaleString());
    console.log("⌛ Закінчення бронювання:", localEnd.toLocaleString());

    // Перевірка на минулий час
    if (localStart < now) {
      console.warn("❌ Неможливо забронювати на минулий час!");
      setBookingError("Неможливо забронювати на минулий час.");
      return;
    }

    // Перевірка робочих годин
    const DISABLE_TIME_RESTRICTIONS = false; // Встановіть true, щоб вимкнути обмеження

    // Перевірка робочих годин
    if (
      !DISABLE_TIME_RESTRICTIONS &&
      (localStart.getHours() < MIN_HOUR ||
        localEnd.getHours() > MAX_HOUR ||
        (localEnd.getHours() === MAX_HOUR && localEnd.getMinutes() > 0) ||
        localEnd.getDate() !== localStart.getDate())
    ) {
      setBookingError(`Бронювання можливе з ${MIN_HOUR}:00 до ${MAX_HOUR}:00`);
      return;
    }
    // **Конвертуємо бронювання з UTC у локальний час + додаємо буфер 5 хв**
    const hasConflict = bookings.some((booking) => {
      const existingStart = new Date(booking.startTime);
      const existingEnd = new Date(booking.endTime);

      // Перетворюємо UTC-час бронювання в локальний
      const localExistingStart = new Date(
        existingStart.getTime() + existingStart.getTimezoneOffset() * 60000
      );
      const localExistingEnd = new Date(
        existingEnd.getTime() + existingEnd.getTimezoneOffset() * 60000
      );

      // Додаємо буфер у 5 хвилин до початку і після завершення
      const bufferStart = new Date(localExistingStart.getTime() - 5 * 60000);
      const bufferEnd = new Date(localExistingEnd.getTime() + 5 * 60000);

      console.log(
        `🔍 Перевіряємо бронювання ${localExistingStart.toLocaleTimeString()} - ${localExistingEnd.toLocaleTimeString()}`
      );
      console.log(
        `🕐 Буферний інтервал: ${bufferStart.toLocaleTimeString()} - ${bufferEnd.toLocaleTimeString()}`
      );

      // **Ігноруємо бронювання, які вже завершились**
      if (localExistingEnd <= now) {
        console.log("✅ Це бронювання вже завершилось, пропускаємо");
        return false;
      }

      // **Перевіряємо конфлікт з урахуванням буферної зони**
      return localStart < bufferEnd && localEnd > bufferStart;
    });

    // **Встановлення помилки, якщо є конфлікт**
    setBookingError(
      hasConflict ? "Мінімальний проміжок між бронюваннями - 5 хвилин" : ""
    );
  };
  console.log("User in BookingModal:", user);
  const handleReserve = async () => {
    if (!user || !selectedDevice || bookingError) return;

    try {
      console.log("Дані для бронювання:", {
        deviceId: selectedDevice.id,
        userId: user._id,
        userEmail: user.email,
        startTime: new Date(
          `${currentDate}T${startTime.slice(11, 16)}`
        ).toISOString(),
        duration,
        price,
      });

      const response = await axios.post("http://localhost:3001/devices/book", {
        deviceId: selectedDevice.id,
        userId: user._id,
        userEmail: user.email,
        startTime: new Date(
          `${currentDate}T${startTime.slice(11, 16)}`
        ).toISOString(),
        duration,
        price,
      });

      setBookings((prev) => [...prev, response.data.booking]);
      addBooking(response.data.booking);

      // Видаляємо виклик onClose(), щоб вікно залишалося відкритим
      console.log("Бронювання успішно створено:", response.data.booking);
    } catch (error) {
      console.error("Помилка бронювання:", error);
      setBookingError(error.response?.data?.error || "Помилка бронювання");
    }
  };
  useEffect(() => {
    if (startTime) {
      checkTimeConflict(startTime.slice(11, 16), duration);
    }
  }, [startTime, duration]);

  useEffect(() => {
    if (selectedDevice && duration) {
      updatePrice(duration);
    }
  }, [duration, selectedDevice, startTime]);

  const updatePrice = (selectedDuration) => {
    if (!selectedDevice || !selectedDevice.zone) {
      setPrice(0);
      return;
    }

    const zonePrices = priceTable[selectedDevice.zone];
    if (!zonePrices) {
      setPrice(0);
      return;
    }

    const availableDurations = Object.keys(zonePrices)
      .map(Number)
      .sort((a, b) => a - b);

    // Знаходимо найближчу допустиму тривалість
    let closestDuration = availableDurations[0];
    for (let d of availableDurations) {
      if (d <= selectedDuration) closestDuration = d;
      else break;
    }

    setPrice(zonePrices[closestDuration] || 0);
  };

  const handleTimeChange = (e) => {
    setStartTime((prev) => prev.slice(0, 10) + "T" + e.target.value);
  };

  const handleDurationChange = (e) => {
    const newDuration = Number(e.target.value);
    setDuration(newDuration);
    updatePrice(newDuration);
  };

  const handleDeleteBooking = async (bookingId) => {
    try {
      console.log("Видаляємо бронювання з ID:", bookingId);

      const response = await fetch(
        `http://localhost:3001/admin/bookings/${bookingId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            userid: user._id, // Передаємо user._id
          },
        }
      );

      if (response.ok) {
        setBookings((prev) => prev.filter((b) => b._id !== bookingId));

        // Оновлюємо пристрої після видалення бронювання
        if (typeof fetchDevices === "function") {
          fetchDevices(); // Викликаємо функцію для оновлення пристроїв
        }
      } else {
        const errorData = await response.json();
        console.error("Не вдалося видалити бронювання:", errorData);
      }
    } catch (error) {
      console.error("Помилка видалення бронювання:", error);
    }
  };

  return (
    <Modal active={isActive} setActive={onClose}>
      <div className="modal-content-bron">
        <h2>Бронювання {selectedDevice?.id}</h2>

        <p>
          Зона: <span className="red-text">{selectedDevice?.zone}</span>
        </p>
        <p>
          Дата: <span className="red-text">{currentDate}</span>
        </p>

        {bookings.length > 0 ? (
          <div className="booking-list">
            <h3>Заброньовано:</h3>
            <ul>
              {bookings.map((booking) => {
                const bookingStartTime = new Date(booking.startTime);
                const bookingEndTime = new Date(booking.endTime);

                return (
                  <li key={booking._id}>
                    {bookingStartTime.toLocaleTimeString("uk-UA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}{" "}
                    -{" "}
                    {bookingEndTime.toLocaleTimeString("uk-UA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}
                    {(user?.role === "admin" ||
                      user?._id === booking.userId) && (
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteBooking(booking._id)}
                      >
                        Видалити
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p>Цей пристрій зараз вільний.</p>
        )}

        <label>
          Початок:
          <input
            type="time"
            value={startTime.slice(11, 16)}
            onChange={handleTimeChange}
            min="08:00"
            max="23:50"
          />
        </label>

        <label>
          Тривалість (години):
          <select value={duration} onChange={handleDurationChange}>
            {selectedDevice && priceTable[selectedDevice.zone] ? (
              Object.keys(priceTable[selectedDevice.zone])
                .map(Number)
                .map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))
            ) : (
              <option value={1}>1</option>
            )}
          </select>
        </label>

        <p>
          Ціна: <span className="red-text">{price} грн</span>
        </p>

        {bookingError && <div className="error-message">{bookingError}</div>}
        {!user && (
          <div className="error-message">
            Для бронювання потрібно зареєструватися.
          </div>
        )}
        <button onClick={handleReserve} disabled={!user || !!bookingError}>
          Підтвердити
        </button>
      </div>
    </Modal>
  );
};

export default BookingModal;
