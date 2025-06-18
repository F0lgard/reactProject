// filepath: PriceContext.jsx

import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const PriceContext = createContext();

export const usePrice = () => useContext(PriceContext);

export const PriceProvider = ({ children }) => {
  const [priceTable, setPriceTable] = useState({});

  const fetchPriceTable = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/price-table");
      const table = {};
      response.data.forEach((entry) => {
        table[entry.zone] = entry.prices;
      });
      setPriceTable(table);
    } catch (error) {
      console.error("Помилка під час отримання таблиці цін:", error);
    }
  };

  useEffect(() => {
    fetchPriceTable(); // Початкове завантаження

    const interval = setInterval(() => {
      fetchPriceTable(); // Оновлювати кожні 10 секунд (можна змінити)
    }, 100000);

    return () => clearInterval(interval);
  }, []);

  return (
    <PriceContext.Provider value={priceTable}>{children}</PriceContext.Provider>
  );
};
