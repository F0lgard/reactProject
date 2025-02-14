import React from "react";
import "../styles/DeviceButton.css";
import pcMonitorIcon from "../img/pcMonitor.png";
import controllerIcon from "../img/controller.png";

const DeviceButton = ({ id, type, bookings = [], onClick, position }) => {
  const now = new Date();

  const convertToLocalTime = (utcTime) => {
    return new Date(utcTime.getTime() + utcTime.getTimezoneOffset() * 60000);
  };

  // Активне бронювання (локальний час)
  const activeBooking = bookings.find((booking) => {
    const start = convertToLocalTime(new Date(booking.startTime));
    const end = convertToLocalTime(new Date(booking.endTime));
    return start <= now && now < end;
  });

  // Майбутні бронювання (відсортовані за часом)
  const futureBookings = bookings
    .filter((booking) => {
      const start = convertToLocalTime(new Date(booking.startTime));
      return start > now;
    })
    .sort((a, b) => {
      const aStart = convertToLocalTime(new Date(a.startTime));
      const bStart = convertToLocalTime(new Date(b.startTime));
      return aStart - bStart;
    });

  const nearestFuture = futureBookings[0];
  let timeToStart = null;
  if (nearestFuture) {
    const startTime = convertToLocalTime(new Date(nearestFuture.startTime));
    timeToStart = Math.floor((startTime - now) / (1000 * 60)); // хвилини
  }

  let bgColor = "#3DA35D"; // Зелений (вільний)

  if (activeBooking) {
    bgColor = "#FF0000"; // Червоний (активне бронювання)
  } else if (nearestFuture) {
    if (timeToStart <= 10) {
      bgColor = "#ff9800"; // Оранжевий (менше 10хв до старту)
    } else {
      bgColor = "#287740"; // Світло-зелений (майбутнє бронювання)
    }
  }

  const icon = type === "pc" ? pcMonitorIcon : controllerIcon;

  return (
    <button
      className="device-button"
      onClick={() => onClick({ id, type, isBooked: !!activeBooking, position })}
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: bgColor,
      }}
    >
      <div className="icon-container">
        <img src={icon} alt={type} className="device-icon" />
      </div>
      <span className="device-id">{id}</span>
    </button>
  );
};

export default DeviceButton;
