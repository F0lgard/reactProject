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
  const { user, setUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [showAllBookingsMode, setShowAllBookingsMode] = useState(false);
  const [isPasswordChangeFormOpen, setIsPasswordChangeFormOpen] =
    useState(false);
  const [avatar, setAvatar] = useState(
    user?.avatar || "http://localhost:3001/uploads/usericon.png"
  );

  useEffect(() => {
    if (user?.avatar) {
      setAvatar(user.avatar);
    }
  }, [user]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axios.get("http://localhost:3001/bookings", {
        params: {
          userId: user._id,
          role: user.role,
        },
      });

      const formattedBookings = response.data.map((booking) => ({
        ...booking,
        createdAt: booking.startTime,
        date: booking.startTime,
        time: `${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(
          booking.endTime
        ).toLocaleTimeString()}`,
        hours: Math.round(
          (new Date(booking.endTime) - new Date(booking.startTime)) / 3600000
        ),
      }));

      setBookings(
        formattedBookings.sort(
          (a, b) => new Date(b.startTime) - new Date(a.startTime)
        )
      );
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user && user._id) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowAllBookingsMode(false);
    const bookingsForDate = bookings.filter(
      (booking) => new Date(booking.date).toDateString() === date.toDateString()
    );
    setSelectedBookings(
      bookingsForDate.sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
      )
    );
  };

  const handleShowAllBookingsClick = () => {
    setSelectedDate(null);
    setSelectedBookings([...bookings]);
    setShowAllBookingsMode(true);
  };

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000");
    ws.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    // У useEffect для WebSocket
    ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "BOOKING_UPDATED" || data.type === "BOOKING_DELETED") {
        fetchBookings(); // Примусове оновлення списку бронювань
      }
    };
    ws.onclose = () => {
      console.log("WebSocket Client Disconnected");
    };
    return () => {
      ws.close();
    };
  }, []);

  const handleAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const userId = user._id;
    if (!userId) {
      console.error("userId відсутній");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);
    formData.append("userId", userId);

    try {
      const response = await axios.post(
        `http://localhost:3001/upload-avatar`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Оновлюємо user в локальному та глобальному контексті з новим URL аватара
      setUser((prevUser) => ({
        ...prevUser,
        avatar: response.data.avatar,
      }));
      setAvatar(response.data.avatar); // Оновлюємо локальний аватар
    } catch (error) {
      console.error("Error uploading avatar:", error);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    try {
      await axios.delete(`http://localhost:3001/admin/bookings/${bookingId}`, {
        headers: { userid: user._id },
      });

      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
      setSelectedBookings((prev) => prev.filter((b) => b._id !== bookingId));
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
            src={avatar}
            alt="account"
            width="150px"
            height="150px"
            className="user-icon"
          />
          <input type="file" onChange={handleAvatarChange} accept="image/*" />
          <p>
            Ім'я користувача: <span className="red-text">{user?.username}</span>
          </p>
          <p>
            Email: <span className="red-text">{user?.email}</span>
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
          <div className="booking-details-container">
            <h3>
              {showAllBookingsMode
                ? "Всі бронювання"
                : selectedDate
                ? `Бронювання на ${selectedDate.toLocaleDateString()}`
                : "Виберіть дату для перегляду бронювань"}
            </h3>
            <div className="booking-details-list">
              {selectedBookings.map((booking) => (
                <div key={booking._id} className="booking-details">
                  <p>
                    Пристрій:{" "}
                    <span className="red-text">{booking.deviceId}</span>
                  </p>
                  <p>
                    Дата:{" "}
                    <span className="red-text">
                      {new Date(booking.startTime).toLocaleDateString()}
                    </span>
                  </p>
                  <p>
                    Час:{" "}
                    <span className="red-text">
                      {new Date(booking.startTime).toLocaleTimeString("uk-UA", {
                        timeZone: "UTC",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(booking.endTime).toLocaleTimeString("uk-UA", {
                        timeZone: "UTC",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p>
                    Тривалість:{" "}
                    <span className="red-text">{booking.hours} год</span>
                  </p>
                  <p>
                    Ціна: <span className="red-text">{booking.price} грн</span>
                  </p>
                  <p>
                    Зона: <span className="red-text">{booking.zone}</span>
                  </p>
                  {user.role === "admin" && (
                    <>
                      <p>
                        Користувач:{" "}
                        <span className="red-text">{booking.userEmail}</span>
                      </p>
                      <button
                        className="delete-booking-btn"
                        onClick={() => handleDeleteBooking(booking._id)}
                      >
                        Видалити бронювання
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
