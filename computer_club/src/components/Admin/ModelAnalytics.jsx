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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "../../styles/AdminAnalytics.css";

const ZONES = ["Pro", "VIP", "PS"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];
const NO_SHOW_COLORS = {
  "0–10%": "#4caf50",
  "10–20%": "#8bc34a",
  "20–40%": "#9e9e9e",
  "40–60%": "#2196f3",
  "60–80%": "#f44336",
  "80–100%": "#d81b60",
};
const ACTIVITY_COLORS = {
  active: "#4caf50",
  passive: "#ccc",
  new: "#2196f3",
  at_risk: "#f44336",
};

const ModelAnalytics = ({ loading, setLoading }) => {
  const getLocalDateString = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offsetMs);
    return local.toISOString().slice(0, 10);
  };

  const [predictionData, setPredictionData] = useState(null);
  const [trainFrom, setTrainFrom] = useState(getLocalDateString());
  const [trainTo, setTrainTo] = useState(getLocalDateString());
  const [predictFrom, setPredictFrom] = useState(getLocalDateString());
  const [predictTo, setPredictTo] = useState(getLocalDateString());
  const [useAll, setUseAll] = useState(false);
  const [showUpdateModelModal, setShowUpdateModelModal] = useState(false);
  const [updateModelStatus, setUpdateModelStatus] = useState(null);
  const [noShowStats, setNoShowStats] = useState(null);
  const [selectedNoShowGroup, setSelectedNoShowGroup] = useState(null);
  const [noShowGroupUsers, setNoShowGroupUsers] = useState([]);
  const [userActivityData, setUserActivityData] = useState(null);
  const [selectedActivityGroup, setSelectedActivityGroup] = useState(null);
  const [activityGroupUsers, setActivityGroupUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [isLoadingNoShow, setIsLoadingNoShow] = useState(false);
  const [errorNoShow, setErrorNoShow] = useState(null);
  const [noShowProbability, setNoShowProbability] = useState(null);
  const [noShowSearchQuery, setNoShowSearchQuery] = useState("");
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [noShowCurrentPage, setNoShowCurrentPage] = useState(1);
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);
  const [bookingsCurrentPage, setBookingsCurrentPage] = useState(1);
  const usersPerPage = 10;
  const bookingsPerPage = 10;

  // Блокування прокрутки фону для адмін-панелі
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    if (
      selectedNoShowGroup ||
      selectedActivityGroup ||
      selectedUserDetails ||
      showUpdateModelModal
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    selectedNoShowGroup,
    selectedActivityGroup,
    selectedUserDetails,
    showUpdateModelModal,
  ]);

  const fetchPrediction = async () => {
    setLoading(true);
    try {
      const payload = {
        predict_from: predictFrom,
        predict_to: predictTo,
        use_all: useAll,
      };
      if (!useAll) {
        payload.train_from = trainFrom;
        payload.train_to = trainTo;
      }
      console.log("Sending prediction request with payload:", payload);
      const response = await axios.post(
        "http://localhost:5000/api/custom-predict",
        payload
      );
      const dataArray = Array.isArray(response.data.predictions)
        ? response.data.predictions
        : Array.isArray(response.data)
        ? response.data
        : [response.data];
      setPredictionData(dataArray);
    } catch (error) {
      console.error("Помилка прогнозу:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateNoShowModel = async () => {
    setLoading(true);
    setUpdateModelStatus(null);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/update-model"
      );
      console.log("Модель оновлено:", response.data);
      setUpdateModelStatus({ type: "success", message: response.data.message });
    } catch (error) {
      console.error(
        "Помилка оновлення моделі:",
        error.response?.data || error.message
      );
      setUpdateModelStatus({
        type: "error",
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNoShowStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:5000/api/no-show-stats"
      );
      console.log("No-show stats:", response.data);
      setNoShowStats(response.data);
    } catch (error) {
      console.error("Помилка завантаження no-show stats:", error);
      setNoShowStats(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivity = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:5000/api/predict-user-activity-all"
      );
      console.log("User activity data:", response.data);
      const activityCounts = response.data.reduce((acc, { user }) => {
        acc[user.userActivity] = (acc[user.userActivity] || 0) + 1;
        return acc;
      }, {});
      const activityData = Object.entries(activityCounts).map(
        ([name, value]) => ({
          name,
          value,
        })
      );
      setUserActivityData({ data: activityData, users: response.data });
    } catch (error) {
      console.error(
        "Помилка отримання активності:",
        error.response?.data || error.message
      );
    } finally {
      setLoading(false);
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
      const response = await axios.get(
        `http://localhost:5000/api/no-show-probability/${userId}`
      );
      setNoShowProbability(response.data.probability * 100);
    } catch (error) {
      console.error("Помилка отримання ймовірності неявки:", error);
      setErrorNoShow(error.response?.data?.error || error.message);
    } finally {
      setIsLoadingNoShow(false);
    }
  };

  useEffect(() => {
    fetchNoShowStats();
    fetchUserActivity();
  }, []);

  useEffect(() => {
    if (
      selectedUserDetails &&
      selectedUserDetails.noShowProbability !== undefined
    ) {
      setNoShowProbability(selectedUserDetails.noShowProbability);
      setIsLoadingNoShow(false);
      setErrorNoShow(null);
    } else if (selectedUserDetails) {
      fetchNoShowProbability(selectedUserDetails.userId);
    } else {
      setNoShowProbability(null);
      setErrorNoShow(null);
      setIsLoadingNoShow(false);
    }
  }, [selectedUserDetails]);

  const viewNoShowGroupUsers = (group) => {
    console.log("Opening no-show group:", group);
    if (noShowStats && noShowStats.currentDistribution) {
      const groupData = noShowStats.currentDistribution.find(
        (d) => d.range === group
      );
      console.log("Group data:", groupData);
      if (
        groupData &&
        Array.isArray(groupData.users) &&
        groupData.users.length > 0
      ) {
        setNoShowGroupUsers(groupData.users);
        setSelectedNoShowGroup(group);
        setSelectedUsers([]);
        setEmailMessage("");
        setEmailSubject("");
        setNoShowSearchQuery("");
        setNoShowCurrentPage(1);
      } else {
        console.warn("No users found for group:", group);
        alert("Немає користувачів у цій групі.");
      }
    } else {
      console.warn("No-show stats unavailable.");
      alert("Дані неявок відсутні.");
    }
  };

  const viewActivityGroupUsers = (group) => {
    console.log("Opening activity group:", group);
    if (userActivityData && userActivityData.users) {
      const usersInGroup = userActivityData.users
        .filter(({ user }) => user.userActivity === group)
        .map(({ user }) => ({
          userId: user.userId,
          username: user.username || "Без імені",
          email: user.email,
          avatar: user.avatar || "https://via.placeholder.com/40",
          isBlocked: user.isBlocked || false,
          userActivity: user.userActivity,
          createdAt: user.createdAt || "2023-01-01T00:00:00Z",
          totalBookings: user.totalBookings || 0,
          completedBookings: user.completedBookings || 0,
          noShowCount: user.noShowCount || 0,
          cancelCount: user.cancelCount || 0,
          avgDurationHours: user.avgDurationHours || 0,
          bookings: user.bookings || [],
        }));
      console.log("Activity group users:", usersInGroup);
      if (usersInGroup.length > 0) {
        setActivityGroupUsers(usersInGroup);
        setSelectedActivityGroup(group);
        setSelectedUsers([]);
        setEmailMessage("");
        setEmailSubject("");
        setActivitySearchQuery("");
        setActivityCurrentPage(1);
      } else {
        console.warn("No users found for activity group:", group);
        alert("Немає користувачів у цій групі.");
      }
    } else {
      console.warn("User activity data unavailable.");
      alert("Дані активності відсутні.");
    }
  };

  const viewUserDetails = (user) => {
    console.log("Viewing user details:", user);
    fetchUserDetails(user.userId);
  };

  const handleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = (users) => {
    setSelectedUsers(users.map((user) => user.userId));
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const sendEmail = async (users) => {
    if (!emailSubject || !emailMessage) {
      alert("Вкажіть тему та текст повідомлення");
      return;
    }

    const recipientCount = selectedUsers.length || users.length;
    const userConfirmed = window.confirm(
      `Надіслати повідомлення ${recipientCount} користувачам?`
    );
    if (!userConfirmed) {
      return;
    }

    setLoading(true);
    try {
      const emails = selectedUsers.length
        ? users
            .filter((u) => selectedUsers.includes(u.userId))
            .map((u) => u.email)
        : users.map((u) => u.email);

      if (emails.length === 0) {
        alert("Немає користувачів для надсилання повідомлення.");
        return;
      }

      const response = await axios.post(
        "http://localhost:5000/api/send-message",
        {
          emails,
          subject: emailSubject,
          message: emailMessage,
        }
      );

      alert("Повідомлення успішно надіслано!");
      setSelectedNoShowGroup(null);
      setSelectedActivityGroup(null);
      setEmailSubject("");
      setEmailMessage("");
    } catch (error) {
      console.error(
        "Помилка надсилання email:",
        error.message,
        error.response?.data
      );
      alert(
        "Не вдалося надіслати повідомлення: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const closeModal = (type) => {
    if (type === "userDetails") {
      setSelectedUserDetails(null);
      setBookingsCurrentPage(1);
    } else if (type === "noShowGroup") {
      setSelectedNoShowGroup(null);
      setNoShowSearchQuery("");
      setNoShowCurrentPage(1);
    } else if (type === "activityGroup") {
      setSelectedActivityGroup(null);
      setActivitySearchQuery("");
      setActivityCurrentPage(1);
    } else if (type === "updateModel") {
      setShowUpdateModelModal(false);
      setUpdateModelStatus(null);
    }
  };

  // Функція для створення діапазону пагінації
  const getPaginationRange = (currentPage, totalPages) => {
    const delta = 2; // Кількість сторінок зліва і справа від поточної
    const range = [];
    const rangeWithDots = [];
    let prevItem = null;

    // Додаємо сторінки
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      }
    }

    // Додаємо крапки
    for (let i of range) {
      if (prevItem && i - prevItem > 1) {
        rangeWithDots.push("...");
      }
      rangeWithDots.push(i);
      prevItem = i;
    }

    return rangeWithDots;
  };

  const renderPredictionChart = () => {
    if (!predictionData || predictionData.length === 0)
      return <p>Дані для прогнозу відсутні</p>;

    const predictFromDate = new Date(predictFrom);
    const predictToDate = new Date(predictTo);
    const isSingleDay =
      predictFromDate.toDateString() === predictToDate.toDateString();

    if (isSingleDay) {
      const hourlyData = HOURS.map((hour) => {
        const entry = { hour: `${hour}:00` };
        ZONES.forEach((zone) => {
          const found = predictionData.find(
            (d) => d.hour === hour && d.zone === zone
          );
          entry[zone] = found ? found.predicted_bookings || 0 : 0;
        });
        return entry;
      });

      return (
        <div className="chart-block">
          <h3>Прогноз завантаженості (погодинно)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              {ZONES.map((zone) => (
                <Bar
                  key={zone}
                  dataKey={zone}
                  fill={COLORS[ZONES.indexOf(zone)]}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    } else {
      const dailyData = {};
      predictionData.forEach((d) => {
        const date = d.date.split(" ")[0];
        if (!dailyData[date]) {
          dailyData[date] = { date, Pro: 0, VIP: 0, PS: 0, total_bookings: 0 }; // Виправлено TS на PS
        }
        dailyData[date][d.zone] += d.predicted_bookings || 0;
        dailyData[date].total_bookings += d.predicted_bookings || 0;
      });
      const aggregatedDailyData = Object.values(dailyData);

      return (
        <div className="chart-block">
          <h3>Прогноз завантаженості (по днях)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={aggregatedDailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {ZONES.map((zone) => (
                <Bar
                  key={zone}
                  dataKey={zone}
                  stackId="a"
                  fill={COLORS[ZONES.indexOf(zone)]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  };

  const renderNoShowDistributionChart = () => {
    console.log("Rendering NoShowDistribution, noShowStats:", noShowStats);
    if (!noShowStats || !noShowStats.currentDistribution) {
      return <p>Дані розподілу неявок відсутні</p>;
    }

    const chartData = noShowStats.currentDistribution
      .filter((item) => item.count > 0 && item.users && item.users.length > 0)
      .map((item) => ({
        name: item.range,
        value: item.count,
      }));

    const hasData = chartData.length > 0;

    return (
      <div className="chart-block">
        <h3>Розподіл користувачів за відсотком неявки</h3>
        {hasData ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                dataKey="value"
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                fill="#8884d8"
                label
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      NO_SHOW_COLORS[entry.name] ||
                      COLORS[index % COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} користувачів`, name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p>Немає даних для відображення графіка</p>
        )}
        {hasData && (
          <div className="group-buttons">
            {chartData.map((entry) => (
              <button
                key={entry.name}
                onClick={() => viewNoShowGroupUsers(entry.name)}
                className="group-button"
                style={{
                  backgroundColor:
                    NO_SHOW_COLORS[entry.name] ||
                    COLORS[chartData.indexOf(entry) % COLORS.length],
                  color: "#fff",
                  padding: "8px 16px",
                  margin: "5px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Переглянути {entry.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUserActivityChart = () => {
    if (
      !userActivityData ||
      !userActivityData.data ||
      userActivityData.data.length === 0
    ) {
      return <p>Дані активності користувачів відсутні</p>;
    }

    const chartData = userActivityData.data.filter((item) => item.value > 0);

    return (
      <div className="chart-block">
        <h3>Розподіл активності користувачів</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                dataKey="value"
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                fill="#8884d8"
                label
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      ACTIVITY_COLORS[entry.name] ||
                      COLORS[index % COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} користувачів`, name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p>Немає даних для відображення графіка</p>
        )}
        <div className="group-buttons">
          {["active", "passive", "new", "at_risk"]
            .filter((group) =>
              userActivityData.users.some(
                ({ user }) => user.userActivity === group
              )
            )
            .map((group) => (
              <button
                key={group}
                onClick={() => viewActivityGroupUsers(group)}
                className="group-button"
                style={{
                  backgroundColor: ACTIVITY_COLORS[group],
                  color: "#fff",
                  padding: "8px 16px",
                  margin: "5px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Переглянути{" "}
                {group === "active"
                  ? "активних"
                  : group === "passive"
                  ? "пасивних"
                  : group === "new"
                  ? "нових"
                  : "ризик втрати"}
              </button>
            ))}
        </div>
      </div>
    );
  };

  const renderNoShowGroupUsersModal = () => {
    if (!selectedNoShowGroup) return null;

    const filteredUsers = noShowGroupUsers.filter((user) =>
      user.username.toLowerCase().includes(noShowSearchQuery.toLowerCase())
    );

    const indexOfLastUser = noShowCurrentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const paginate = (pageNumber) => setNoShowCurrentPage(pageNumber);

    return (
      <div className="modal-overlay" onClick={() => closeModal("noShowGroup")}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="close-button"
            onClick={() => closeModal("noShowGroup")}
          >
            Закрити
          </button>
          <h2>Користувачі: {selectedNoShowGroup}</h2>
          <div className="user-list-controls">
            <input
              type="text"
              placeholder="Пошук за ім'ям користувача"
              value={noShowSearchQuery}
              onChange={(e) => {
                setNoShowSearchQuery(e.target.value);
                setNoShowCurrentPage(1);
              }}
              className="search-input"
            />
            <button
              onClick={() => selectAllUsers(filteredUsers)}
              className="select-all-button"
            >
              Вибрати всіх
            </button>
            <button onClick={deselectAllUsers} className="deselect-all-button">
              Скасувати вибір
            </button>
          </div>
          <p>
            Обрано: {selectedUsers.length} з {filteredUsers.length}
          </p>
          <div className="user-list">
            {filteredUsers.length === 0 ? (
              <p>Немає користувачів за вашим запитом</p>
            ) : (
              currentUsers.map((user) => (
                <div
                  key={user.userId}
                  className="user-item clickable"
                  onClick={() => viewUserDetails(user)}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.userId)}
                    onChange={() => handleUserSelection(user.userId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <img src={user.avatar} alt="Avatar" className="user-avatar" />
                  <div className="user-info">
                    <p>
                      <strong>{user.username}</strong>
                      {user.isBlocked && <span> (Заблоковано)</span>}
                    </p>
                    <p>{user.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {filteredUsers.length > 0 && (
            <>
              <div className="pagination">
                <button
                  onClick={() => paginate(noShowCurrentPage - 1)}
                  disabled={noShowCurrentPage === 1}
                  className="pagination-button"
                >
                  Попередня
                </button>
                {getPaginationRange(noShowCurrentPage, totalPages).map(
                  (item, index) =>
                    item === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="pagination-ellipsis"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => paginate(item)}
                        className={`pagination-button ${
                          noShowCurrentPage === item ? "active" : ""
                        }`}
                      >
                        {item}
                      </button>
                    )
                )}
                <button
                  onClick={() => paginate(noShowCurrentPage + 1)}
                  disabled={noShowCurrentPage === totalPages}
                  className="pagination-button"
                >
                  Наступна
                </button>
              </div>
              <div className="email-form">
                <h3>Надіслати повідомлення</h3>
                <input
                  type="text"
                  placeholder="Тема повідомлення"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="email-input"
                />
                <textarea
                  placeholder="Текст повідомлення"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="email-textarea"
                />
                <div className="modal-buttons">
                  <button
                    onClick={() => sendEmail(filteredUsers)}
                    disabled={loading}
                    className="send-button"
                  >
                    {loading ? "Надсилання..." : "Надіслати"}
                  </button>
                  <button
                    onClick={() => closeModal("noShowGroup")}
                    className="close-button"
                  >
                    Закрити
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderActivityGroupUsersModal = () => {
    if (!selectedActivityGroup) return null;

    const groupName =
      selectedActivityGroup === "active"
        ? "Активні"
        : selectedActivityGroup === "passive"
        ? "Пасивні"
        : selectedActivityGroup === "new"
        ? "Нові"
        : "Ризик втрати";

    const filteredUsers = activityGroupUsers.filter((user) =>
      user.username.toLowerCase().includes(activitySearchQuery.toLowerCase())
    );

    const indexOfLastUser = activityCurrentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const paginate = (pageNumber) => setActivityCurrentPage(pageNumber);

    return (
      <div
        className="modal-overlay"
        onClick={() => closeModal("activityGroup")}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="close-button"
            onClick={() => closeModal("activityGroup")}
          >
            Закрити
          </button>
          <h2>Користувачі: {groupName}</h2>
          <div className="user-list-controls">
            <input
              type="text"
              placeholder="Пошук за ім'ям користувача"
              value={activitySearchQuery}
              onChange={(e) => {
                setActivitySearchQuery(e.target.value);
                setActivityCurrentPage(1);
              }}
              className="search-input"
            />
            <button
              onClick={() => selectAllUsers(filteredUsers)}
              className="select-all-button"
            >
              Вибрати всіх
            </button>
            <button onClick={deselectAllUsers} className="deselect-all-button">
              Скасувати вибір
            </button>
          </div>
          <p>
            Обрано: {selectedUsers.length} з {filteredUsers.length}
          </p>
          <div className="user-list">
            {filteredUsers.length === 0 ? (
              <p>Немає користувачів за вашим запитом</p>
            ) : (
              currentUsers.map((user) => (
                <div
                  key={user.userId}
                  className="user-item clickable"
                  onClick={() => viewUserDetails(user)}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.userId)}
                    onChange={() => handleUserSelection(user.userId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <img src={user.avatar} alt="Avatar" className="user-avatar" />
                  <div className="user-info">
                    <p>
                      <strong>{user.username}</strong>
                      {user.isBlocked && <span> (Заблоковано)</span>}
                    </p>
                    <p>{user.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {filteredUsers.length > 0 && (
            <>
              <div className="pagination">
                <button
                  onClick={() => paginate(activityCurrentPage - 1)}
                  disabled={activityCurrentPage === 1}
                  className="pagination-button"
                >
                  Попередня
                </button>
                {getPaginationRange(activityCurrentPage, totalPages).map(
                  (item, index) =>
                    item === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="pagination-ellipsis"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => paginate(item)}
                        className={`pagination-button ${
                          activityCurrentPage === item ? "active" : ""
                        }`}
                      >
                        {item}
                      </button>
                    )
                )}
                <button
                  onClick={() => paginate(activityCurrentPage + 1)}
                  disabled={activityCurrentPage === totalPages}
                  className="pagination-button"
                >
                  Наступна
                </button>
              </div>
              <div className="email-form">
                <h3>Надіслати повідомлення</h3>
                <input
                  type="text"
                  placeholder="Тема повідомлення"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="email-input"
                />
                <textarea
                  placeholder="Текст повідомлення"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="email-textarea"
                />
                <div className="modal-buttons">
                  <button
                    onClick={() => sendEmail(filteredUsers)}
                    disabled={loading}
                    className="send-button"
                  >
                    {loading ? "Надсилання..." : "Надіслати"}
                  </button>
                  <button
                    onClick={() => closeModal("activityGroup")}
                    className="close-button"
                  >
                    Закрити
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderUserDetailsModal = () => {
    if (!selectedUserDetails) return null;

    const sortedBookings = [...(selectedUserDetails.bookings || [])].sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );

    const indexOfLastBooking = bookingsCurrentPage * bookingsPerPage;
    const indexOfFirstBooking = indexOfLastBooking - bookingsPerPage;
    const currentBookings = sortedBookings.slice(
      indexOfFirstBooking,
      indexOfLastBooking
    );
    const totalPages = Math.ceil(sortedBookings.length / bookingsPerPage);

    const paginate = (pageNumber) => setBookingsCurrentPage(pageNumber);

    return (
      <div className="modal-overlay" onClick={() => closeModal("userDetails")}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="close-button"
            onClick={() => closeModal("userDetails")}
          >
            Закрити
          </button>
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
              <strong>Всього бронювань:</strong>{" "}
              {selectedUserDetails.totalBookings || 0}
            </p>
            <p>
              <strong>Завершених:</strong>{" "}
              {selectedUserDetails.completedBookings || 0}
            </p>
            <p>
              <strong>No-show:</strong> {selectedUserDetails.noShowCount || 0}
            </p>
            <p>
              <strong>Скасованих:</strong>{" "}
              {selectedUserDetails.cancelCount || 0}
            </p>
            <p>
              <strong>Середня тривалість (години):</strong>{" "}
              {selectedUserDetails.avgDurationHours
                ? selectedUserDetails.avgDurationHours.toFixed(2)
                : "0.00"}
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
            {sortedBookings.length > 0 ? (
              <>
                <div className="bookings-table-container">
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
                      {currentBookings.map((booking, index) => (
                        <tr key={index}>
                          <td>
                            {new Date(booking.startTime).toLocaleString(
                              "uk-UA"
                            )}
                          </td>
                          <td>
                            {new Date(booking.endTime).toLocaleString("uk-UA")}
                          </td>
                          <td>{booking.status}</td>
                          <td>
                            {booking.durationHours
                              ? booking.durationHours.toFixed(2)
                              : "0.00"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedBookings.length > bookingsPerPage && (
                  <div className="pagination">
                    <button
                      onClick={() => paginate(bookingsCurrentPage - 1)}
                      disabled={bookingsCurrentPage === 1}
                      className="pagination-button"
                    >
                      Попередня
                    </button>
                    {getPaginationRange(bookingsCurrentPage, totalPages).map(
                      (item, index) =>
                        item === "..." ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="pagination-ellipsis"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => paginate(item)}
                            className={`pagination-button ${
                              bookingsCurrentPage === item ? "active" : ""
                            }`}
                          >
                            {item}
                          </button>
                        )
                    )}
                    <button
                      onClick={() => paginate(bookingsCurrentPage + 1)}
                      disabled={bookingsCurrentPage === totalPages}
                      className="pagination-button"
                    >
                      Наступна
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>Бронювань немає</p>
            )}
          </div>
          <div className="modal-buttons">
            <button
              onClick={() => closeModal("userDetails")}
              className="close-button"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderUpdateModelModal = () => {
    if (!showUpdateModelModal) return null;

    return (
      <div className="modal-overlay" onClick={() => closeModal("updateModel")}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="close-button"
            onClick={() => closeModal("updateModel")}
          >
            Закрити
          </button>
          <h2>Оновлення моделі No-Show</h2>
          <p>
            Ви впевнені, що хочете оновити модель прогнозування неявок? Ця дія
            може зайняти деякий час.
          </p>
          {updateModelStatus && (
            <p
              className={`status-message ${
                updateModelStatus.type === "success" ? "success" : "error"
              }`}
            >
              {updateModelStatus.message}
            </p>
          )}
          <div className="modal-buttons">
            <button
              onClick={updateNoShowModel}
              disabled={loading}
              className="confirm-button"
            >
              {loading ? "Оновлення..." : "Оновити модель"}
            </button>
            <button
              onClick={() => closeModal("updateModel")}
              className="close-button"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-analytics-container">
      <div className="chart-block">
        <h3>Оновлення моделі прогнозування</h3>
        <button
          onClick={() => setShowUpdateModelModal(true)}
          disabled={loading}
          className="update-model-button"
        >
          Оновити модель No-Show
        </button>
      </div>
      <div className="chart-block">
        <h3>Прогноз завантаженості</h3>
        <div className="date-picker">
          <div className="date-row">
            <label>Період для навчання:</label>
            <input
              type="date"
              value={trainFrom}
              onChange={(e) => setTrainFrom(e.target.value)}
              disabled={useAll}
            />
            <input
              type="date"
              value={trainTo}
              onChange={(e) => setTrainTo(e.target.value)}
              disabled={useAll}
            />
          </div>
          <div className="date-row">
            <label>Період для прогнозу:</label>
            <input
              type="date"
              value={predictFrom}
              onChange={(e) => setPredictFrom(e.target.value)}
            />
            <input
              type="date"
              value={predictTo}
              onChange={(e) => setPredictTo(e.target.value)}
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={useAll}
              onChange={(e) => setUseAll(e.target.checked)}
            />{" "}
            Навчати на всіх даних
          </label>
          <button
            onClick={fetchPrediction}
            disabled={loading}
            className="predict-button"
          >
            {loading ? "Прогнозування..." : "Зробити прогноз"}
          </button>
        </div>
        {renderPredictionChart()}
      </div>
      <div className="chart-block">
        <h3>Аналіз користувачів</h3>
        {renderNoShowDistributionChart()}
        {renderUserActivityChart()}
      </div>
      {renderNoShowGroupUsersModal()}
      {renderActivityGroupUsersModal()}
      {renderUserDetailsModal()}
      {renderUpdateModelModal()}
    </div>
  );
};

export default ModelAnalytics;
