// Recommendations.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Recommendations.css";
import { useAuth } from "./AuthContext";
import { useBookings } from "./BookingsContext";

const Recommendations = ({ onScrollToMap }) => {
  const { user } = useAuth();
  const { bookings } = useBookings();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    if (!user || !user._id) {
      console.error("userId не знайдено");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(
        `http://localhost:5000/api/recommendations/filtered/${user._id}`
      );
      setRecommendations(response.data);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const handleBookingClick = (deviceId, recommendedDuration) => {
    onScrollToMap(deviceId, recommendedDuration); // Передаємо deviceId і recommendedDuration
  };

  if (!user || bookings.length === 0) {
    return null;
  }

  if (loading) {
    return <p>Loading recommendations...</p>;
  }

  return (
    <section className="recommendations-bck">
      <h1 className="recommendations-title">Рекомендації</h1>
      <p className="recommendations-subtitle">Обери найкраще для себе</p>
      <div className="recommendations-container">
        {recommendations.length > 0 ? (
          recommendations.map((rec) => (
            <div key={rec.deviceId} className="recommendation-card">
              <h3>ПК: {rec.id}</h3>
              <p>Зона: {rec.zone}</p>
              <p>Тип: {rec.type}</p>
              <p>Рекомендована тривалість: {rec.avg_duration} год</p>
              <p>Ціна: {rec.avg_price} грн</p>
              <button
                onClick={() =>
                  handleBookingClick(rec.deviceId, rec.avg_duration)
                }
              >
                Забронювати
              </button>
            </div>
          ))
        ) : (
          <p>Немає рекомендацій для відображення.</p>
        )}
      </div>
    </section>
  );
};

export default Recommendations;
