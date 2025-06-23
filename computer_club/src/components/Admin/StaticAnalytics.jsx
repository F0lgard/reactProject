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
const COLORS = [
  "#1976D2", // насичений синій
  "#283593", // темно-синій
  "#512DA8", // фіолетовий
  "#5E35B1", // фіолетово-синій
  "#3949AB", // синьо-фіолетовий
  "#1565C0", // ще темніший синій
  "#00B8D4", // бірюзовий/блакитний
  "#1A237E", // дуже темний синій
  "#0D1333", // майже чорний синій
  "#311B92", // дуже темний фіолетовий
  "#0D47A1", // глибокий синій
  "#6200EA", // яскравий фіолетовий для контрасту
];

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

  const dailyLoadData = Array.isArray(summary.dailyBookings)
    ? summary.dailyBookings
        .map(({ date, count }) => ({
          day: new Date(date).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          }),
          rawDate: new Date(date),
          count,
        }))
        .sort((a, b) => a.rawDate - b.rawDate)
    : [];

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
    </div>
  );
};

export default StaticAnalytics;
