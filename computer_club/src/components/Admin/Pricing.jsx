import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../styles/AdminAnalytics.css";

const getToday = () => {
  const today = new Date();
  console.log("Current date:", today);
  return today
    .toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" })
    .split("/")
    .reverse()
    .join("-");
};

const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow
    .toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" })
    .split("/")
    .reverse()
    .join("-");
};

const Pricing = () => {
  const [discounts, setDiscounts] = useState([]);
  const [newDiscount, setNewDiscount] = useState({
    zone: "Pro",
    startDate: getToday(), // "2025-06-19"
    endDate: getTomorrow(), // "2025-06-20"
    discountPercentage: 0,
    applyToAllZones: false,
    specificPeriod: "",
  });
  const [priceTable, setPriceTable] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dynamicPrices, setDynamicPrices] = useState({});

  useEffect(() => {
    fetchDiscounts();
    fetchPriceTable();
    fetchDynamicPrices();

    // Періодичне оновлення динамічних цін кожні 30 секунд
    const interval = setInterval(() => {
      fetchDynamicPrices();
    }, 30000);

    // Очищення інтервалу при розмонтуванні компонента
    return () => clearInterval(interval);
  }, []);

  const fetchDiscounts = async () => {
    const response = await axios.get("http://localhost:5000/api/discounts");
    setDiscounts(response.data);
  };

  const fetchPriceTable = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/price-table");
      const transformed = response.data.map((entry) => ({
        zone: entry.zone,
        prices: entry.prices,
      }));
      setPriceTable(transformed);
    } catch (error) {
      console.error("Помилка під час отримання таблиці цін:", error);
    }
  };

  const fetchDynamicPrices = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/price-table/dynamic"
      );
      setDynamicPrices(res.data);
    } catch (e) {
      console.warn("Не вдалося завантажити динамічні ціни:", e);
    }
  };

  const handleCreateDiscount = async () => {
    setLoading(true);
    try {
      const payload = {
        zone: newDiscount.applyToAllZones ? "all" : newDiscount.zone,
        startDate: new Date(
          `${newDiscount.startDate}T${
            newDiscount.specificPeriod.split("-")[0] || "00:00"
          }`
        ).toISOString(),
        endDate: new Date(
          `${newDiscount.endDate}T${
            newDiscount.specificPeriod.split("-")[1] || "23:59"
          }`
        ).toISOString(),
        discountPercentage: newDiscount.discountPercentage,
        applyToAllZones: newDiscount.applyToAllZones,
      };

      const [startTime, endTime] = newDiscount.specificPeriod.split("-");
      if (startTime && endTime) {
        payload.specificPeriod = newDiscount.specificPeriod;
      } else {
        delete payload.specificPeriod;
      }

      console.log("Sending payload:", payload);
      await axios.post("http://localhost:5000/api/discounts", payload);
      fetchDiscounts();
      fetchPriceTable();
      fetchDynamicPrices(); // Оновлення динамічних цін після створення
      setNewDiscount({
        zone: "Pro",
        startDate: getToday(),
        endDate: getTomorrow(),
        discountPercentage: 0,
        applyToAllZones: false,
        specificPeriod: "",
      });
      alert("Акцію успішно створено та ціни оновлено!");
    } catch (error) {
      console.error("Помилка створення акції:", error);
      alert("Не вдалося створити акцію.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscount = async (id) => {
    if (window.confirm("Ви впевнені, що хочете видалити цю акцію?")) {
      setLoading(true);
      try {
        await axios.delete(`http://localhost:5000/api/discounts/${id}`);
        fetchDiscounts();
        fetchPriceTable();
        fetchDynamicPrices(); // Оновлення динамічних цін після видалення
        alert("Акцію видалено та ціни оновлено!");
      } catch (error) {
        console.error("Помилка видалення акції:", error);
        alert("Не вдалося видалити акцію.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (zone, duration, value) => {
    setPriceTable((prevTable) =>
      prevTable.map((row) =>
        row.zone === zone
          ? {
              ...row,
              prices: {
                ...row.prices,
                [duration]: value ? parseInt(value, 10) : "",
              },
            }
          : row
      )
    );
  };

  const handleSave = async () => {
    setTableLoading(true);
    try {
      for (const row of priceTable) {
        await axios.post("http://localhost:5000/api/price-table", {
          zone: row.zone,
          prices: row.prices,
        });
      }
      fetchDynamicPrices(); // Оновлення після збереження
      alert("Таблиця цін успішно оновлена!");
    } catch (error) {
      console.error("Помилка під час оновлення таблиці цін:", error);
      alert("Не вдалося оновити таблицю цін.");
    } finally {
      setTableLoading(false);
    }
  };

  return (
    <div className="pricing-container">
      <div className="discount-section">
        <h3 className="section-title">Створити акцію</h3>
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={newDiscount.applyToAllZones}
              onChange={(e) =>
                setNewDiscount({
                  ...newDiscount,
                  applyToAllZones: e.target.checked,
                  zone: e.target.checked ? "all" : newDiscount.zone || "Pro",
                })
              }
            />{" "}
            Застосувати до всіх зон
          </label>
        </div>
        <div className="create-discount-form">
          {!newDiscount.applyToAllZones && (
            <select
              value={newDiscount.zone}
              onChange={(e) =>
                setNewDiscount({ ...newDiscount, zone: e.target.value })
              }
              className="select-zone"
            >
              <option value="Pro">Pro</option>
              <option value="VIP">VIP</option>
              <option value="PS">PS</option>
            </select>
          )}
          <div className="date-group">
            <input
              type="date"
              value={newDiscount.startDate}
              onChange={(e) =>
                setNewDiscount({
                  ...newDiscount,
                  startDate: e.target.value,
                })
              }
              required
              className="date-input"
              min={getToday()}
            />
            <input
              type="date"
              value={newDiscount.endDate}
              onChange={(e) =>
                setNewDiscount({
                  ...newDiscount,
                  endDate: e.target.value,
                })
              }
              className="date-input"
              min={newDiscount.startDate || getToday()}
            />
          </div>
          <div className="time-group">
            <input
              type="time"
              value={newDiscount.specificPeriod.split("-")[0] || ""}
              onChange={(e) =>
                setNewDiscount({
                  ...newDiscount,
                  specificPeriod: `${e.target.value}-${
                    newDiscount.specificPeriod.split("-")[1] || ""
                  }`,
                })
              }
              className="time-input"
              placeholder="Початок"
            />
            <input
              type="time"
              value={newDiscount.specificPeriod.split("-")[1] || ""}
              onChange={(e) =>
                setNewDiscount({
                  ...newDiscount,
                  specificPeriod: `${
                    newDiscount.specificPeriod.split("-")[0] || ""
                  }-${e.target.value}`,
                })
              }
              className="time-input"
              placeholder="Кінець"
            />
          </div>
          <input
            type="number"
            value={newDiscount.discountPercentage}
            onChange={(e) =>
              setNewDiscount({
                ...newDiscount,
                discountPercentage: e.target.value,
              })
            }
            placeholder="Введіть знижку (%)"
            min="0"
            max="100"
            required
            className="discount-input"
          />
        </div>
        <button
          onClick={handleCreateDiscount}
          disabled={loading}
          className="create-button"
        >
          {loading ? "Створення..." : "Створити"}
        </button>
      </div>
      <div className="discount-section">
        <h3 className="section-title">Активні акції</h3>
        {discounts.length === 0 ? (
          <p className="no-discounts">Немає активних акцій.</p>
        ) : (
          <table className="discount-table">
            <thead>
              <tr>
                <th>Зона</th>
                <th>Старт</th>
                <th>Кінець</th>
                <th>Період</th>
                <th>Знижка (%)</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d._id}>
                  <td>{d.zone === "all" ? "Усі зони" : d.zone}</td>
                  <td>{d.startDate}</td>
                  <td>{d.endDate || d.startDate}</td>
                  <td>{d.specificPeriod || "Весь день"}</td>
                  <td>{d.discountPercentage}%</td>
                  <td>
                    <button
                      onClick={() => handleDeleteDiscount(d._id)}
                      disabled={loading}
                      className="delete-button"
                    >
                      {loading ? "Видалення..." : "Видалити"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="editable-price-table">
        <h3 className="section-title">Редагувати таблицю цін</h3>
        <table className="table-price-admin">
          <thead>
            <tr>
              <th>Зона</th>
              <th>1 Година</th>
              <th>3 Години</th>
              <th>5 Годин</th>
              <th>7 Годин</th>
            </tr>
          </thead>
          <tbody>
            {priceTable.map((row) => (
              <tr key={row.zone}>
                <td>{row.zone}</td>
                {[1, 3, 5, 7].map((duration) => {
                  const basePrice = row.prices[duration] || "";
                  const dynamic =
                    dynamicPrices?.[row.zone]?.[duration] !== undefined
                      ? dynamicPrices[row.zone][duration]
                      : null;

                  const hasDiscount = dynamic !== null && dynamic !== basePrice;

                  return (
                    <td key={duration}>
                      <input
                        type="number"
                        value={basePrice}
                        onChange={(e) =>
                          handleInputChange(row.zone, duration, e.target.value)
                        }
                        className="price-input"
                      />
                      {hasDiscount && (
                        <div className="dynamic-price-note">
                          Зараз: <strong>{dynamic} грн</strong>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={handleSave}
          disabled={tableLoading}
          className="save-button"
        >
          {tableLoading ? "Збереження..." : "Зберегти зміни"}
        </button>
      </div>
    </div>
  );
};

export default Pricing;
