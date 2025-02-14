import React, { createContext, useState, useEffect, useContext } from "react";
import { useAuth } from "./AuthContext";
import axios from "axios";

const BookingsContext = createContext();

export const useBookings = () => useContext(BookingsContext);

export const BookingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (user && user._id) {
        try {
          const response = await axios.get(
            `http://localhost:3001/bookings/user/${user._id}`
          );
          setBookings(response.data);
        } catch (error) {
          console.error("Помилка отримання бронювань:", error);
        }
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 10000); // Оновлення кожні 10 секунд
    return () => clearInterval(interval);
  }, [user]);

  // BookingsContext.jsx
  const addBooking = (newBooking) => {
    setBookings((prevBookings) => [...prevBookings, newBooking]);
  };

  return (
    <BookingsContext.Provider value={{ bookings, setBookings, addBooking }}>
      {children}
    </BookingsContext.Provider>
  );
};
