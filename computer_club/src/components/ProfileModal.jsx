import React, { useState, useEffect, useCallback } from "react";
import Modal from "./Modal";
import { useAuth } from "./AuthContext";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/Profile.css";
import "../styles/CalendarOverrides.css";
import axios from "axios";

const ProfileModal = ({ active, setActive }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [showAllBookingsMode, setShowAllBookingsMode] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/bookings/user/${user._id}`
      );
      const sortedBookings = response.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setBookings(sortedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user && user._id) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "NEW_BOOKING") {
        setBookings((prevBookings) => [data.booking, ...prevBookings]);
      }
    };
    ws.onclose = () => {
      console.log("WebSocket Client Disconnected");
    };
    return () => {
      ws.close();
    };
  }, []);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowAllBookingsMode(false);
    const bookingsForDate = bookings.filter(
      (booking) =>
        new Date(booking.createdAt).toDateString() === date.toDateString()
    );
    setSelectedBookings(bookingsForDate);
  };

  const handleShowAllBookingsClick = () => {
    setSelectedDate(null);
    setSelectedBookings(bookings);
    setShowAllBookingsMode(true);
  };

  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const bookingDates = bookings.map((booking) =>
        new Date(booking.createdAt).toDateString()
      );
      if (bookingDates.includes(date.toDateString())) {
        return "highlight";
      }
    }
    return null;
  };

  return (
    <Modal active={active} setActive={setActive}>
      <h2 className="user-profile">Профіль користувача</h2>
      <div className="profile-modal">
        <div className="user-info-wrap">
          <img
            src={require("../img/usericon.png")}
            alt="account"
            width="283px"
            height="171px"
            className="user-icon"
          />
          <p>
            Ім'я користувача: <span className="red-text">{user?.username}</span>
          </p>
          <p>
            Email: <span className="red-text">{user?.email}</span>
          </p>
          <p>
            Пароль: <span className="red-text">{user?.password}</span>
          </p>
          <button
            onClick={handleShowAllBookingsClick}
            className="show-all-bookings"
          >
            Показати всі бронювання
          </button>
        </div>
        <div className="calendar-container">
          <Calendar
            onClickDay={handleDateClick}
            tileClassName={tileClassName}
          />
        </div>
        <div className="bookingselected">
          {showAllBookingsMode ? (
            <div className="booking-details-container">
              <h3>Всі бронювання</h3>
              <div className="booking-details-list">
                {selectedBookings.map((booking) => (
                  <div key={booking._id} className="booking-details">
                    <p>
                      Дата: {new Date(booking.createdAt).toLocaleDateString()}
                    </p>
                    <p>Зона: {booking.zone}</p>
                    <p>Кількість годин: {booking.hours}</p>
                    <p>Ціна: {booking.price}₴</p>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedDate && selectedBookings.length > 0 ? (
            <div className="booking-details-container">
              <h3>Деталі бронювання</h3>
              <div className="booking-details-list">
                {selectedBookings.map((booking) => (
                  <div key={booking._id} className="booking-details">
                    <p>
                      Дата: {new Date(booking.createdAt).toLocaleDateString()}
                    </p>
                    <p>Зона: {booking.zone}</p>
                    <p>Кількість годин: {booking.hours}</p>
                    <p>Ціна: {booking.price}₴</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="selected-date">
              Виберіть дату, щоб переглянути деталі бронювання.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
