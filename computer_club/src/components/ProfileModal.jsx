import React, { useState, useEffect, useCallback } from "react";
import Modal from "./Modal";
import { useAuth } from "./AuthContext";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/Profile.css";
import "../styles/CalendarOverrides.css";
import axios from "axios";
import ChangePasswordForm from "./ChangePasswordForm";

const ProfileModal = ({ active, setActive }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [showAllBookingsMode, setShowAllBookingsMode] = useState(false);
  const [isPasswordChangeFormOpen, setIsPasswordChangeFormOpen] =
    useState(false);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      let response;
      if (user.role === "admin") {
        response = await axios.get("http://localhost:3001/bookings");
      } else {
        response = await axios.get(
          `http://localhost:3001/bookings/user/${user._id}`
        );
      }
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
    const ws = new WebSocket("ws://localhost:8000");
    ws.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "NEW_BOOKING") {
        setBookings((prevBookings) => [data.booking, ...prevBookings]);
      } else if (data.type === "DELETE_BOOKING") {
        setBookings((prevBookings) =>
          prevBookings.filter((booking) => booking._id !== data.booking._id)
        );
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

  const handleDeleteBooking = async (bookingId) => {
    try {
      await axios.delete(`http://localhost:3001/bookings/${bookingId}`);
      setBookings((prevBookings) =>
        prevBookings.filter((booking) => booking._id !== bookingId)
      );
      if (selectedDate) {
        setSelectedBookings((prevSelectedBookings) =>
          prevSelectedBookings.filter((booking) => booking._id !== bookingId)
        );
      } else {
        setSelectedBookings((prevSelectedBookings) =>
          prevSelectedBookings.filter((booking) => booking._id !== bookingId)
        );
      }
    } catch (error) {
      console.error("Error deleting booking:", error);
    }
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

  const handleOpenChangePasswordForm = () => {
    setIsPasswordChangeFormOpen(true);
  };

  const handleCloseChangePasswordForm = () => {
    setIsPasswordChangeFormOpen(false);
  };

  if (!user) {
    return null; // Return null or a loader if user is not available
  }

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
            Role: <span className="red-text">{user?.role}</span>
          </p>
          <a
            onClick={handleOpenChangePasswordForm}
            className="change-password-a"
          >
            Змінити пароль
          </a>
          <button
            onClick={handleShowAllBookingsClick}
            className="show-all-bookings"
          >
            Показати всі бронювання
          </button>
        </div>
        {isPasswordChangeFormOpen && (
          <ChangePasswordForm
            user={user}
            setActive={handleCloseChangePasswordForm}
          />
        )}
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
                      Дата бронювання:{" "}
                      <span className="red-text">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                    <p>
                      Обрана дата:{" "}
                      <span className="red-text">
                        {new Date(booking.date).toLocaleDateString()}
                      </span>
                    </p>
                    <p>
                      Зона: <span className="red-text">{booking.zone}</span>
                    </p>
                    <p>
                      Кількість годин:{" "}
                      <span className="red-text">{booking.hours}</span>
                    </p>
                    <p>
                      Ціна: <span className="red-text">{booking.price}₴</span>
                    </p>
                    {user.role === "admin" && (
                      <>
                        <p>
                          Емейл користувача:{" "}
                          <span className="red-text">{booking.userEmail}</span>
                        </p>
                        <img
                          src={require("../img/trashcan.png")}
                          alt="account"
                          width="35px"
                          height="35px"
                          className="delete-icon"
                          onClick={() => handleDeleteBooking(booking._id)}
                        />
                      </>
                    )}
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
                    {user.role === "admin" && (
                      <img
                        src={require("../img/trashcan.png")}
                        alt="delete"
                        width="35px"
                        height="35px"
                        className="delete-icon"
                        onClick={() => handleDeleteBooking(booking._id)}
                      />
                    )}
                    <p>
                      Дата бронювання:{" "}
                      <span className="red-text">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                    <p>
                      Обрана дата:{" "}
                      <span className="red-text">
                        {new Date(booking.date).toLocaleDateString()}
                      </span>
                    </p>
                    <p>
                      Зона: <span className="red-text">{booking.zone}</span>
                    </p>
                    <p>
                      Кількість годин:{" "}
                      <span className="red-text">{booking.hours}</span>
                    </p>
                    <p>
                      Ціна: <span className="red-text">{booking.price}₴</span>
                    </p>
                    {user.role === "admin" && (
                      <p>
                        Емейл користувача:{" "}
                        <span className="red-text">{booking.userEmail}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="booking-details-container">
              <h3>Виберіть дату для перегляду бронювань</h3>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
