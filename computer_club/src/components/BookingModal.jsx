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

const BookingModal = ({ isActive, onClose, selectedDevice }) => {
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
      const filteredBookings = (selectedDevice.bookings || []).filter(
        (booking) => {
          const bookingDate = new Date(booking.startTime);
          return bookingDate.toISOString().split("T")[0] === currentDate;
        }
      );
      setBookings(filteredBookings);
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
    if (
      localStart.getHours() < MIN_HOUR ||
      localEnd.getHours() > MAX_HOUR ||
      (localEnd.getHours() === MAX_HOUR && localEnd.getMinutes() > 0) ||
      localEnd.getDate() !== localStart.getDate()
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

  // 2. Оновлення стану bookings після успішного бронювання
  const handleReserve = async () => {
    if (!user || !selectedDevice || bookingError) return;

    try {
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

      // Додаємо нове бронювання до локального стану
      setBookings((prev) => [...prev, response.data.booking]);
      addBooking(response.data.booking);
      onClose();
    } catch (error) {
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
      await fetch(`http://localhost:3001/admin/bookings/${bookingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          userid: user._id,
        },
      });

      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
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
              {bookings.map((booking) => (
                <li key={booking._id}>
                  {new Date(booking.startTime).toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  -{" "}
                  {new Date(booking.endTime).toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                  {user?.role === "admin" && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteBooking(booking._id)}
                    >
                      Видалити
                    </button>
                  )}
                </li>
              ))}
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
        <button onClick={handleReserve} disabled={!!bookingError}>
          Підтвердити
        </button>
      </div>
    </Modal>
  );
};

export default BookingModal;
