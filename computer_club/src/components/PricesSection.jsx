import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Table.css";

export default function PricesSection() {
  const [priceTable, setPriceTable] = useState({});

  const fetchPriceTable = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/price-table/dynamic"
      );
      console.log("Дані з сервера:", response.data);
      setPriceTable(response.data);
    } catch (error) {
      console.error("Помилка під час отримання таблиці динамічних цін:", error);
    }
  };

  useEffect(() => {
    fetchPriceTable();
    const interval = setInterval(fetchPriceTable, 30000);
    return () => clearInterval(interval);
  }, []);

  const durations = [1, 3, 5, 7];

  return (
    <div className="prices-section" id="prices">
      <h2 className="prices-section-name">Ціни</h2>
      <table className="table-price">
        <thead>
          <tr>
            <th className="table-zone zonu">Зони</th>
            {durations.map((d) => (
              <th key={d}>{d} год</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(priceTable).map(([zone, prices]) => (
            <tr key={zone}>
              <td className="table-zone">{zone}</td>
              {durations.map((duration) => (
                <td key={duration} className="price-cell">
                  {prices[duration] ? `${prices[duration]} грн` : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
