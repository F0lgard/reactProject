import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import "../../styles/AdminAnalytics.css";

const ACTIVITY_COLORS = {
  active: "#4caf50",
  passive: "#9e9e9e",
  new: "#2196f3",
  at_risk: "#f44336",
};

const UserManagement = ({ loading, setLoading }) => {
  const [activityTrends, setActivityTrends] = useState([]);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [noShowProbability, setNoShowProbability] = useState(null);
  const [isLoadingNoShow, setIsLoadingNoShow] = useState(false);
  const [errorNoShow, setErrorNoShow] = useState(null);
  const [topUsersRisk, setTopUsersRisk] = useState([]);

  const fetchActivityTrends = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/activity-trends",
        {
          params: {
            from: new Date(
              new Date().setMonth(new Date().getMonth() - 1)
            ).toISOString(),
            to: new Date().toISOString(),
          },
        }
      );
      setActivityTrends(response.data);
    } catch (error) {
      console.error(
        "Помилка отримання трендів:",
        error.response?.data || error.message
      );
    }
  };

  const fetchTopUsersRisk = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/top-users-risk"
      );
      setTopUsersRisk(response.data.topUsers);
    } catch (error) {
      console.error(
        "Помилка отримання топ-користувачів із ризиком неявки:",
        error.response?.data || error.message
      );
    }
  };

  const fetchUserDetails = async (userId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/user-details/${userId}`
      );
      setSelectedUserDetails(response.data);
    } catch (error) {
      console.error(
        "Помилка отримання деталей користувача:",
        error.response?.data || error.message
      );
      alert("Не вдалося отримати деталі користувача");
    } finally {
      setLoading(false);
    }
  };

  const fetchNoShowProbability = async (userId) => {
    setIsLoadingNoShow(true);
    setErrorNoShow(null);
    try {
      const startTime = new Date(Date.now() + 3600 * 1000).toISOString();
      const deviceZone = "Pro";
      const response = await axios.get(
        "http://localhost:5000/predict/no-show",
        {
          params: {
            userId,
            startTime,
            deviceZone,
          },
        }
      );
      setNoShowProbability(response.data.noShowProbability);
    } catch (error) {
      console.error(
        `Помилка прогнозу no-show для userId ${userId}:`,
        error.response?.data || error.message
      );
      setErrorNoShow("Не вдалося отримати прогноз");
      setNoShowProbability(null);
    } finally {
      setIsLoadingNoShow(false);
    }
  };

  const toggleUserBlock = async (userId, isBlocked) => {
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/block-user", {
        userId,
        isBlocked: !isBlocked,
      });
      alert(`Користувача ${isBlocked ? "розблоковано" : "заблоковано"}!`);
      await fetchUserDetails(userId);
    } catch (error) {
      console.error("Помилка блокування:", error);
      alert("Не вдалося змінити статус користувача.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityTrends();
    fetchTopUsersRisk();
  }, []);

  useEffect(() => {
    if (selectedUserDetails?.userId) {
      fetchNoShowProbability(selectedUserDetails.userId);
    }
  }, [selectedUserDetails]);

  const renderTopUsersRiskChart = () => {
    if (!topUsersRisk || topUsersRisk.length === 0) {
      return <p>Дані про користувачів із ризиком неявки відсутні.</p>;
    }

    const validData = topUsersRisk.filter(
      (user) => user.username && user.noShowProbability !== undefined
    );

    if (validData.length === 0) {
      return <p>Дані про користувачів із ризиком неявки некоректні.</p>;
    }

    return (
      <div className="chart-block">
        <h3>Топ-5 користувачів з високим ризиком неявки</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={validData}
            layout="vertical"
            margin={{ top: 0, right: 250, left: 50, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis
              dataKey="username"
              type="category"
              width={150}
              tickFormatter={(value) =>
                value.length > 20 ? `${value.slice(0, 17)}...` : value
              }
            />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar dataKey="noShowProbability" fill="#f44336" barSize={30} />
          </BarChart>
        </ResponsiveContainer>
        <button
          onClick={async () => {
            try {
              const response = await axios.post(
                "http://localhost:5000/api/send-message",
                {
                  topUsersRisk: true,
                  subject: "Нагадування про явку",
                  message: "Будь ласка, підтвердіть вашу явку на завтра.",
                }
              );
              alert("Повідомлення надіслано!");
            } catch (error) {
              console.error("Помилка:", error);
              alert("Не вдалося надіслати повідомлення.");
            }
          }}
        >
          Надіслати листи топ-5
        </button>
      </div>
    );
  };

  const renderActivityTrendsChart = () => {
    if (!activityTrends || activityTrends.length === 0)
      return <p>Дані трендів відсутні</p>;

    return (
      <div className="chart-block">
        <h3>Тренди активності користувачів</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={activityTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="active"
              stroke="#4caf50"
              name="Активні"
            />
            <Line
              type="monotone"
              dataKey="passive"
              stroke="#9e9e9e"
              name="Пасивні"
            />
            <Line type="monotone" dataKey="new" stroke="#2196f3" name="Нові" />
            <Line
              type="monotone"
              dataKey="at_risk"
              stroke="#f44336"
              name="Ризик втрати"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderUserDetailsModal = () => {
    if (!selectedUserDetails) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Деталі користувача: {selectedUserDetails.username}</h2>
          <div className="user-details">
            <p>
              <strong>Email:</strong> {selectedUserDetails.email}
            </p>
            <p>
              <strong>Дата реєстрації:</strong>{" "}
              {new Date(selectedUserDetails.createdAt).toLocaleDateString(
                "uk-UA"
              )}
            </p>
            <p>
              <strong>Статус:</strong>{" "}
              {selectedUserDetails.isBlocked ? "Заблоковано" : "Активний"}
            </p>
            <p>
              <strong>Всього бронювань:</strong>{" "}
              {selectedUserDetails.totalBookings}
            </p>
            <p>
              <strong>Завершених:</strong>{" "}
              {selectedUserDetails.completedBookings}
            </p>
            <p>
              <strong>No-show:</strong> {selectedUserDetails.noShowCount}
            </p>
            <p>
              <strong>Скасованих:</strong> {selectedUserDetails.cancelCount}
            </p>
            <p>
              <strong>Середня тривалість (години):</strong>{" "}
              {selectedUserDetails.avgDurationHours}
            </p>
            <p>
              <strong>Ризик неявки:</strong>{" "}
              {isLoadingNoShow
                ? "Завантаження..."
                : errorNoShow
                ? errorNoShow
                : noShowProbability !== null
                ? `${noShowProbability.toFixed(1)}%`
                : "Н/Д"}
            </p>
            <h3>Історія бронювань</h3>
            {selectedUserDetails.bookings.length === 0 ? (
              <p>Бронювань немає</p>
            ) : (
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Початок</th>
                    <th>Кінець</th>
                    <th>Статус</th>
                    <th>Тривалість (год)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUserDetails.bookings.map((booking, index) => (
                    <tr key={index}>
                      <td>
                        {new Date(booking.startTime).toLocaleString("uk-UA")}
                      </td>
                      <td>
                        {new Date(booking.endTime).toLocaleString("uk-UA")}
                      </td>
                      <td>{booking.status}</td>
                      <td>{booking.durationHours.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              onClick={() =>
                toggleUserBlock(
                  selectedUserDetails.userId,
                  selectedUserDetails.isBlocked
                )
              }
              disabled={loading}
              className={
                selectedUserDetails.isBlocked
                  ? "unblock-button"
                  : "block-button"
              }
            >
              {loading
                ? "Обробка..."
                : selectedUserDetails.isBlocked
                ? "Розблокувати"
                : "Заблокувати"}
            </button>
          </div>
          <button
            onClick={() => setSelectedUserDetails(null)}
            className="close-button"
          >
            Закрити
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderActivityTrendsChart()}
      {renderTopUsersRiskChart()}
      {renderUserDetailsModal()}
    </div>
  );
};

export default UserManagement;
