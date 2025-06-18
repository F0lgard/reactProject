import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import "../styles/BookingModal.css";
import { useAuth } from "./AuthContext";
import { useBookings } from "./BookingsContext";
import axios from "axios";
import { usePrice } from "./PriceContext";

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

const BookingModal = ({
  isActive,
  onClose,
  selectedDevice,
  fetchDevices,
  recommendedDuration,
}) => {
  const { user } = useAuth();
  const { addBooking } = useBookings();
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [bookingError, setBookingError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [price, setPrice] = useState(0);
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [noShowRisks, setNoShowRisks] = useState({}); // Стан для зберігання ризиків no-show для кожного bookingId
  const priceTable = usePrice();

  // Оновлення дати кожну хвилину
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(getLocalDateString());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isActive && recommendedDuration) {
      setDuration(recommendedDuration);
    }
  }, [isActive, recommendedDuration]);

  // Фільтрація та сортування бронювань
  useEffect(() => {
    if (selectedDevice) {
      const now = new Date();

      const filteredBookings = (selectedDevice.bookings || []).filter(
        (booking) => {
          const bookingEndTime = new Date(booking.endTime);
          return (
            bookingEndTime > now &&
            !["cancelled", "noShow", "completed"].includes(booking.status)
          );
        }
      );

      const sortedBookings = filteredBookings.sort((a, b) => {
        return new Date(a.startTime) - new Date(b.startTime);
      });

      setBookings(sortedBookings);
    }
  }, [selectedDevice]);

  // Завантаження ризиків no-show
  useEffect(() => {
    const fetchRisks = async () => {
      if (!selectedDevice || !bookings.length) return;

      const risks = {};
      for (const booking of bookings) {
        try {
          const response = await axios.get(
            "http://localhost:5000/predict/no-show",
            {
              params: {
                userId: booking.userId,
                startTime: booking.startTime,
                deviceZone: selectedDevice.zone,
                endTime: booking.endTime,
                deviceId: selectedDevice.id,
              },
            }
          );
          risks[booking._id] = response.data.noShowProbability;
        } catch (error) {
          console.error(
            `Помилка прогнозу для ${booking._id}:`,
            error.response?.data || error.message
          );
          risks[booking._id] = null;
        }
      }
      setNoShowRisks(risks);
    };

    fetchRisks();
  }, [selectedDevice, bookings]);

  useEffect(() => {
    if (isActive) {
      const now = new Date();
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
        targetTime.setMinutes(targetTime.getMinutes() + 10);
      }

      const timeString = `${String(targetTime.getHours()).padStart(
        2,
        "0"
      )}:${String(targetTime.getMinutes()).padStart(2, "0")}`;
      const localISOTime = `${currentDate}T${timeString}`;
      setStartTime(localISOTime);
    }
  }, [isActive, currentDate]);

  const checkTimeConflict = (newStartTime, newDuration) => {
    if (!selectedDevice) return;

    const localStart = new Date(`${currentDate}T${newStartTime}`);
    const localEnd = new Date(localStart.getTime() + newDuration * 3600000);

    const now = new Date();

    console.log("📌 Поточний час:", now.toLocaleString());
    console.log("⏳ Початок бронювання:", localStart.toLocaleString());
    console.log("⌛ Закінчення бронювання:", localEnd.toLocaleString());

    if (localStart < now) {
      console.warn("❌ Неможливо забронювати на минулий час!");
      setBookingError("Неможливо забронювати на минулий час.");
      return;
    }

    const DISABLE_TIME_RESTRICTIONS = false;

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

    const hasConflict = bookings.some((booking) => {
      const existingStart = new Date(booking.startTime);
      const existingEnd = new Date(booking.endTime);

      const localExistingStart = new Date(
        existingStart.getTime() + existingStart.getTimezoneOffset() * 60000
      );
      const localExistingEnd = new Date(
        existingEnd.getTime() + existingEnd.getTimezoneOffset() * 60000
      );

      const bufferStart = new Date(localExistingStart.getTime() - 5 * 60000);
      const bufferEnd = new Date(localExistingEnd.getTime() + 5 * 60000);

      console.log(
        `🔍 Перевіряємо бронювання ${localExistingStart.toLocaleTimeString()} - ${localExistingEnd.toLocaleTimeString()}`
      );
      console.log(
        `🕐 Буферний інтервал: ${bufferStart.toLocaleTimeString()} - ${bufferEnd.toLocaleTimeString()}`
      );

      return localStart < bufferEnd && localEnd > bufferStart;
    });

    setBookingError(
      hasConflict ? "Мінімальний проміжок між бронюваннями - 5 хвилин" : ""
    );
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const bookingToCancel = bookings.find((b) => b._id === bookingId);
      if (!bookingToCancel) throw new Error("Бронювання не знайдено");

      const response = await axios.post(
        "http://localhost:3001/api/cancel-booking",
        {
          deviceId: selectedDevice.id,
          bookingId,
          userId: user._id,
          startTime: bookingToCancel.startTime,
        },
        { headers: { role: user?.role || "user" } }
      );

      if (response.data.success) {
        setBookings((prev) => prev.filter((b) => b._id !== bookingId));
        fetchDevices();
        console.log("Бронювання скасовано:", response.data.message);
      }
    } catch (error) {
      console.error("Помилка:", error.response?.data || error.message);
      setBookingError(error.response?.data?.error || "Не вдалося скасувати");
    }
  };

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
  }, [duration, selectedDevice, priceTable]);

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

  return (
    <Modal
      active={isActive}
      setActive={onClose}
      customStyles={{ background: "none", boxShadow: "none", padding: "0" }}
    >
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
                        onClick={() => handleCancelBooking(booking._id)}
                      >
                        Скасувати (N-s:{" "}
                        {noShowRisks[booking._id] !== undefined &&
                        noShowRisks[booking._id] !== null
                          ? `${noShowRisks[booking._id].toFixed(1)}%`
                          : "Завантаження..."}
                        )
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
        <button
          className="modal-content-bron-btn "
          onClick={handleReserve}
          disabled={!user || !!bookingError}
        >
          Підтвердити
        </button>
      </div>
    </Modal>
  );
};

export default BookingModal;
