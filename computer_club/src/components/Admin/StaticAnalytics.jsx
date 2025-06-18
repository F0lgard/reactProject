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

const ZONES = ["Pro", "VIP", "PS"];
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];

const StaticAnalytics = ({ loading, setLoading }) => {
  const getLocalDateString = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offsetMs);
    return local.toISOString().slice(0, 10);
  };

  const [summary, setSummary] = useState(null);
  const [from, setFrom] = useState(getLocalDateString());
  const [to, setTo] = useState(getLocalDateString());

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3001/analytics/summary?from=${from}&to=${to}`
      );
      console.log("Summary data:", response.data);
      setSummary(response.data);
    } catch (error) {
      console.error("Помилка отримання аналітики:", error);
    } finally {
      setLoading(false);
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
          day: new Date(date).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          }),
          rawDate: new Date(date),
          revenue,
        }))
        .sort((a, b) => a.rawDate - b.rawDate)
    : [];

  if (dailyRevenueData.length > 0) {
    const lastDate = new Date(to).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
    if (!dailyRevenueData.some((entry) => entry.day === lastDate)) {
      dailyRevenueData.push({
        day: lastDate,
        rawDate: new Date(to),
        revenue: 0,
      });
    }
    dailyRevenueData.sort((a, b) => a.rawDate - b.rawDate);
  }

  const formattedDailyRevenueData = dailyRevenueData.map(
    ({ day, revenue }) => ({ day, revenue })
  );

  const calculateDailyBookings = () => {
    const bookingsByDay = new Map();
    if (summary && Array.isArray(summary.devices)) {
      summary.devices.forEach((device) => {
        if (Array.isArray(device.bookings)) {
          device.bookings.forEach((booking) => {
            if (booking.startTime) {
              const startDate = new Date(booking.startTime)
                .toISOString()
                .split("T")[0];
              const fromDate = new Date(from);
              const toDate = new Date(to);
              const bookingDate = new Date(startDate);
              if (bookingDate >= fromDate && bookingDate <= toDate) {
                bookingsByDay.set(
                  startDate,
                  (bookingsByDay.get(startDate) || 0) + 1
                );
              }
            }
          });
        }
      });
    }
    const result = Array.from(bookingsByDay.entries()).map(([date, count]) => ({
      day: new Date(date).toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }),
      count,
    }));
    console.log("Daily bookings:", result);
    return result;
  };

  const dailyLoadData = calculateDailyBookings();

  const EditablePriceTable = () => {
    const [priceTable, setPriceTable] = useState([]);
    const [tableLoading, setTableLoading] = useState(false);

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
      setTableLoading(true);
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
        alert("Не вдалося оновити таблицю цін.");
      } finally {
        setTableLoading(false);
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
        <button onClick={handleSave} disabled={tableLoading}>
          {tableLoading ? "Збереження..." : "Зберегти зміни"}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="date-picker">
        <label>Період з: </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <label> по: </label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        {/*<button
          className="refresh-button"
          onClick={fetchSummary}
          disabled={loading}
        >
          {loading ? "Оновлення..." : "Оновити"}
        </button>*/}
      </div>
      <div className="summary-cards">
        <div className="card">
          <h3>Загальний прибуток</h3>
          <p>{summary?.totalRevenue || 0} грн</p>
        </div>
        <div className="card">
          <h3>Активні бронювання</h3>
          <p>{summary?.activeBookingsCount || 0}</p>
        </div>
        <div className="card">
          <h3>Загальна кількість бронювань</h3>
          <p>{summary?.totalBookingsCount || 0}</p>
        </div>
      </div>
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
      <div className="chart-block">
        <h3>Навантаження по годинах</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourlyLoadData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-block">
        <h3>Навантаження (по днях)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dailyLoadData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-block">
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
      <div className="chart-block-full">
        <EditablePriceTable />
      </div>
    </div>
  );
};

export default StaticAnalytics;
