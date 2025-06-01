import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Table.css";

export default function PricesSection() {
  const [priceTable, setPriceTable] = useState([]);

  // Функція для отримання таблиці цін
  const fetchPriceTable = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/price-table");
      setPriceTable(response.data);
    } catch (error) {
      console.error("Помилка під час отримання таблиці цін:", error);
    }
  };

  // Використання Polling для динамічного оновлення
  useEffect(() => {
    fetchPriceTable(); // Початкове завантаження
    const interval = setInterval(fetchPriceTable, 5000); // Оновлення кожні 5 секунд
    return () => clearInterval(interval); // Очищення інтервалу при розмонтуванні
  }, []);

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
          {priceTable.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="table-zone">{row.zone}</td>
              {[1, 3, 5, 7].map((duration, colIndex) => (
                <td key={colIndex} className="price-cell">
                  {row.prices[duration] !== undefined
                    ? `${row.prices[duration]} грн`
                    : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
