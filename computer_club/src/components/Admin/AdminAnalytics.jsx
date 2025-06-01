import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import "../../styles/AdminAnalytics.css";
import HeatMapGrid from "react-heatmap-grid";

const ZONES = ["Pro", "VIP", "PS"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // Години з 8:00 до 23:00
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];

const AdminAnalytics = () => {
  const getLocalDateString = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offsetMs);
    return local.toISOString().slice(0, 10);
  };

  const [summary, setSummary] = useState(null);
  const [from, setFrom] = useState(getLocalDateString);
  const [to, setTo] = useState(getLocalDateString);
  const [loading, setLoading] = useState(false);
  const [predictionData, setPredictionData] = useState(null);
  const [training, setTraining] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    console.log("Запит на сервер з датами:", { from, to }); // Логування перед запитом
    try {
      const response = await axios.get(
        `http://localhost:3001/analytics/summary?from=${from}&to=${to}`
      );
      console.log("Отримані дані з сервера:", response.data); // Логування відповіді сервера
      setSummary(response.data);
    } catch (error) {
      console.error("Помилка отримання аналітики:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrediction = async () => {
    setLoading(true);
    console.log("Запит на прогноз з датами:", { from, to }); // Логування перед запитом
    try {
      const response = await axios.post(
        "http://localhost:5000/api/predict-load",
        {
          startDate: from,
          endDate: to,
        }
      );
      console.log("Отримані дані прогнозу:", response.data); // Логування відповіді сервера
      setPredictionData(response.data);
    } catch (error) {
      console.error("Помилка отримання прогнозу:", error);
    } finally {
      setLoading(false);
    }
  };

  const retrainModel = async () => {
    setTraining(true);
    console.log("Запуск донавчання моделі...");
    try {
      const response = await axios.post(
        "http://localhost:5000/api/retrain-model"
      );
      console.log("Результат донавчання:", response.data); // Логування відповіді сервера
      alert("Модель успішно донавчена!");
    } catch (error) {
      console.error("Помилка донавчання моделі:", error);
      alert("Помилка донавчання моделі. Перевірте сервер.");
    } finally {
      setTraining(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [from, to]);

  if (!summary) return <div>Завантаження аналітики...</div>;

  const profitByZoneData = summary.zoneStats
    ? Object.entries(summary.zoneStats).map(([zone, stats]) => ({
        name: zone,
        value: stats.revenue,
      }))
    : [];

  const hourlyLoadData = Array.isArray(summary.hourUsage)
    ? summary.hourUsage.map((val, i) => ({
        hour: `${i}:00`,
        count: val,
      }))
    : [];

  const dailyRevenueData = Array.isArray(summary.dailyRevenue)
    ? summary.dailyRevenue
        .map(({ date, revenue }) => ({
          // Формат дати: "20.05.25" (день.місяць.рік)
          day: new Date(date).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          }),
          rawDate: new Date(date), // Зберігаємо оригінальну дату для сортування
          revenue,
        }))
        .sort((a, b) => a.rawDate - b.rawDate) // Сортуємо за датою
    : [];

  // Додаємо останню дату, якщо її немає
  if (dailyRevenueData.length > 0) {
    const lastDate = new Date(to).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

    if (!dailyRevenueData.some((entry) => entry.day === lastDate)) {
      dailyRevenueData.push({
        day: lastDate,
        rawDate: new Date(to), // Додаємо оригінальну дату для сортування
        revenue: 0,
      });
    }

    // Повторно сортуємо після додавання останньої дати
    dailyRevenueData.sort((a, b) => a.rawDate - b.rawDate);
  }

  // Видаляємо поле rawDate перед передачею в графік
  const formattedDailyRevenueData = dailyRevenueData.map(
    ({ day, revenue }) => ({
      day,
      revenue,
    })
  );

  const EditablePriceTable = () => {
    const [priceTable, setPriceTable] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const fetchPriceTable = async () => {
        try {
          const response = await axios.get(
            "http://localhost:5000/api/price-table"
          );
          setPriceTable(response.data);
        } catch (error) {
          console.error("Помилка під час отримання таблиці цін:", error);
        }
      };

      fetchPriceTable();
    }, []);

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
      setLoading(true);
      try {
        for (const row of priceTable) {
          await axios.post("http://localhost:5000/api/price-table", {
            zone: row.zone,
            prices: row.prices,
          });
        }
        alert("Таблиця цін успішно оновлена!");
      } catch (error) {
        console.error("Помилка під час оновлення таблиці цін:", error);
        alert("Не вдалося оновити таблицю цін. Перевірте сервер.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="editable-price-table">
        <h3>Редагувати таблицю цін</h3>
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
                {[1, 3, 5, 7].map((duration) => (
                  <td key={duration}>
                    <input
                      type="number"
                      value={row.prices[duration] || ""}
                      onChange={(e) =>
                        handleInputChange(row.zone, duration, e.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={handleSave} disabled={loading}>
          {loading ? "Збереження..." : "Зберегти зміни"}
        </button>
      </div>
    );
  };

  const zoneColors = {
    Pro: "#2F59BB",
    VIP: "#B08CF9",
    PS: "#E74888",
  };

  const renderPredictionChart = () => {
    if (!predictionData) return null;

    if (from === to) {
      // Погодинний графік для одного дня
      const hourlyZoneData = [];

      for (let hour = 8; hour < 24; hour++) {
        const hourEntry = { hour: `${hour}:00` };
        for (const zone of ["Pro", "VIP", "PS"]) {
          const found = predictionData.find(
            (d) => d.hour === hour && d.zone === zone
          );
          hourEntry[zone] = found ? found.expectedBookings : 0;
        }
        hourlyZoneData.push(hourEntry);
      }

      return (
        <div className="chart-block">
          <h3>Прогноз завантаженості (погодинно)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyZoneData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              {["Pro", "VIP", "PS"].map((zone) => (
                <Bar
                  key={zone}
                  dataKey={zone}
                  stackId="a"
                  fill={zoneColors[zone]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    } else {
      // Графік для кількох днів
      const dailyData = predictionData.map((item) => ({
        day: item.date,
        expectedBookings: item.expectedBookings,
      }));

      return (
        <div className="chart-block">
          <h3>Прогноз завантаженості (по днях)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="expectedBookings"
                stroke="#8884d8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
  };

  return (
    <div className="admin-analytics-modal">
      <div className="admin-analytics-container">
        <h2 className="admin-header">Аналітична панель адміністратора</h2>

        {/* Вибір періоду та кнопка оновлення */}
        <div className="date-picker">
          <label>Період з: </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label> по: </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            className="refresh-button"
            onClick={fetchSummary}
            disabled={loading}
          >
            {loading ? "Оновлення..." : "Оновити"}
          </button>
        </div>

        {/* Кнопки для прогнозу та донавчання */}
        <div className="action-buttons">
          <button
            className="predict-button"
            onClick={fetchPrediction}
            disabled={loading}
          >
            {loading ? "Прогнозування..." : "Зробити прогноз"}
          </button>
          <button
            className="retrain-button"
            onClick={retrainModel}
            disabled={training}
          >
            {training ? "Тренування..." : "Оновити модель"}
          </button>
        </div>

        {/* Загальні показники */}
        <div className="summary-cards">
          <div className="card">
            <h3>Загальний прибуток</h3>
            <p>{summary.totalRevenue || 0} грн</p>
          </div>

          <div className="card">
            <h3>Активні бронювання</h3>
            <p>{summary.activeBookingsCount || 0}</p>
          </div>

          <div className="card">
            <h3>Загальна кількість бронювань</h3>
            <p>{summary.totalBookingsCount || 0}</p>
          </div>
        </div>

        {/* Графік прогнозу */}
        {renderPredictionChart()}

        {/* Прибуток по зонах */}
        <div className="chart-block">
          <h3>Прибуток по зонах</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                dataKey="value"
                data={profitByZoneData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                fill="#8884d8"
                label
              >
                {profitByZoneData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Навантаження по годинах */}
        <div className="chart-block">
          <h3>Навантаження по годинах</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyLoadData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Динаміка прибутку */}
        <div className="chart-block-full">
          <h3>Динаміка прибутку</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedDailyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8884d8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Форма для оновлення таблиці цін */}
        <div className="chart-block-full">
          <EditablePriceTable />
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
