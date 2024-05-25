import React, { useState } from "react";
import Button from "./Button";
import "../styles/Table.css";
import Modal from "./Modal";
import { useAuth } from "./AuthContext";
import axios from "axios";

export default function PricesSection() {
  const { isAuthenticated, user } = useAuth();
  const [selectedCell, setSelectedCell] = useState(null);
  const [bronModalActive, setBronModalActive] = useState(false);

  const handleCellClick = (zone, hours, price) => {
    setSelectedCell({ zone, hours, price });
  };

  const handleReserve = async () => {
    if (!selectedCell) return;

    const bookingData = {
      zone: selectedCell.zone,
      hours: selectedCell.hours,
      price: selectedCell.price,
      userId: user._id,
    };

    // console.log("Booking data:", bookingData); // Додаємо логування для перевірки

    try {
      const response = await axios.post(
        "http://localhost:3001/bookings",
        bookingData
      );

      console.log("Booking successful:", response.data);
      setBronModalActive(false);
    } catch (error) {
      console.error("Error booking:", error);
    }
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
                    selectedCell.hours === colIndex + 1
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    price !== null &&
                    handleCellClick(row.zone, colIndex + 1, price)
                  }
                >
                  {price !== null ? `${price}₴` : "------"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isAuthenticated && (
        <Button
          className="button-zabronuvatu"
          disabled={!selectedCell}
          onClick={() => setBronModalActive(true)}
        >
          Забронювати
        </Button>
      )}
      {bronModalActive && (
        <Modal active={bronModalActive} setActive={setBronModalActive}>
          <div className="modal-content">
            <h3>Підтвердження бронювання</h3>
            {selectedCell && (
              <>
                <p>Зона: {selectedCell.zone}</p>
                <p>Кількість годин: {selectedCell.hours}</p>
                <p>Ціна: {selectedCell.price}₴</p>
                <Button onClick={handleReserve}>Підтвердити бронювання</Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
