import React, { useState, useEffect } from "react";
import Button from "./Button";
import "../styles/Table.css";
import Modal from "./Modal";
import { useAuth } from "./AuthContext";
import { useBookings } from "./BookingsContext";
import axios from "axios";
import ProfileModal from "./ProfileModal";

export default function PricesSection() {
  const { isAuthenticated, user } = useAuth();
  const { bookings, addBooking } = useBookings();
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [bronModalActive, setBronModalActive] = useState(false);
  const [authNotification, setAuthNotification] = useState(false);
  const [profileModalActive, setProfileModalActive] = useState(false);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 3);
    const maxDateString = maxDate.toISOString().split("T")[0];

    if (
      new Date(selectedDate) < new Date(todayString) ||
      new Date(selectedDate) > new Date(maxDateString)
    ) {
      setSelectedDate(todayString);
    }
  }, [selectedDate]);

  const handleCellClick = (zone, hours, price) => {
    console.log(`Selected Zone: ${zone}, Hours: ${hours}, Price: ${price}`);
    setSelectedCell({ zone, hours, price });
  };

  const handleReserve = async () => {
    if (!selectedCell || !selectedDate) {
      setBookingError("Будь ласка, виберіть дату.");
      return;
    }

    const today = new Date();
    const todayString = today.toISOString().split("T")[0];
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 3);
    const maxDateString = maxDate.toISOString().split("T")[0];

    if (
      new Date(selectedDate) < new Date(todayString) ||
      new Date(selectedDate) > new Date(maxDateString)
    ) {
      setBookingError(
        "Ви не можете забронювати на минуле число або більше ніж на 3 дні вперед."
      );
      return;
    }

    const bookingData = {
      zone: selectedCell.zone,
      hours: selectedCell.hours,
      price: selectedCell.price,
      userId: user._id,
      date: selectedDate,
    };

    console.log("Booking data:", bookingData);

    const userBookingsForDay = bookings.filter(
      (booking) =>
        booking.userId === user._id &&
        new Date(booking.date).toISOString().split("T")[0] === bookingData.date
    );

    const totalHoursForDay = userBookingsForDay.reduce(
      (total, booking) => total + booking.hours,
      0
    );

    if (totalHoursForDay + bookingData.hours > 10) {
      setBookingError("Ви не можете забронювати більше ніж 10 годин на день.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/bookings",
        bookingData
      );

      console.log("Booking successful:", response.data);
      addBooking(response.data.booking);
      setBronModalActive(false);
      if (profileModalActive) {
        setProfileModalActive(false);
        setProfileModalActive(true);
      }
    } catch (error) {
      console.error("Error booking:", error);
    }
  };

  const handleReserveClick = () => {
    if (isAuthenticated) {
      setBronModalActive(true);
    } else {
      setAuthNotification(true);
    }
  };

  const closeAuthNotification = () => {
    setAuthNotification(false);
  };

  return (
    <div className="prices-section" id="prices">
      <h2 className="prices-section-name">Ціни</h2>
      <table className="table-price">
        <thead>
          <tr>
            <th className="table-zone zonu">Зони</th>
            <th>1 Година</th>
            <th>3 Години</th>
            <th>5 Годин</th>
            <th>7 Годин</th>
          </tr>
        </thead>
        <tbody>
          {[
            { zone: "Pro Zone", prices: [80, 225, 350, 450] },
            { zone: "VIP Zone", prices: [120, 350, 550, 700] },
            { zone: "PlayStation", prices: [200, 500, null, null] },
          ].map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="table-zone">{row.zone}</td>
              {row.prices.map((price, colIndex) => (
                <td
                  key={colIndex}
                  className={`price-cell ${
                    selectedCell &&
                    selectedCell.zone === row.zone &&
                    selectedCell.hours ===
                      (colIndex === 0 ? 1 : colIndex * 2 + 1)
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    price !== null &&
                    handleCellClick(
                      row.zone,
                      colIndex === 0 ? 1 : colIndex * 2 + 1,
                      price
                    )
                  }
                >
                  {price !== null ? `${price}₴` : "------"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        className="button-zabronuvatu"
        disabled={!selectedCell}
        onClick={handleReserveClick}
      >
        Забронювати
      </Button>
      {bronModalActive && (
        <Modal active={bronModalActive} setActive={setBronModalActive}>
          <div className="modal-content-bron">
            <h3 className="modal-name-bron">Підтвердження бронювання</h3>
            {selectedCell && (
              <>
                <p>
                  Зона: <span className="red-text">{selectedCell.zone}</span>
                </p>
                <p>
                  Кількість годин:{" "}
                  <span className="red-text">{selectedCell.hours}</span>
                </p>
                <p>
                  Ціна: <span className="red-text">{selectedCell.price}₴</span>
                </p>
                <p>
                  Виберіть дату:
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    min={new Date().toISOString().split("T")[0]}
                    max={
                      new Date(new Date().setDate(new Date().getDate() + 3))
                        .toISOString()
                        .split("T")[0]
                    }
                  />
                </p>
                <Button onClick={handleReserve} className="modal-button-bron">
                  Підтвердити
                </Button>
                {bookingError && <p className="error-text">{bookingError}</p>}
              </>
            )}
          </div>
        </Modal>
      )}
      {authNotification && (
        <Modal active={authNotification} setActive={setAuthNotification}>
          <div className="modal-content-auth">
            <h3>Не має доступу</h3>
            <p>Будь ласка, авторизуйтесь, щоб зробити бронювання.</p>
            <Button
              onClick={closeAuthNotification}
              className="modal-button-auth"
            >
              Закрити
            </Button>
          </div>
        </Modal>
      )}
      <ProfileModal
        active={profileModalActive}
        setActive={setProfileModalActive}
      />
    </div>
  );
}
