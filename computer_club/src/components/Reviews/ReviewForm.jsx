import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import "./ReviewForm.css"; // Підключення CSS для стилів

const ReviewForm = ({ addReview }) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [avatar, setAvatar] = useState(
    user?.avatar || "http://localhost:3001/uploads/usericon.png"
  ); // Дефолтне фото

  useEffect(() => {
    // Оновлюємо аватар, коли user.avatar змінюється або стає доступним
    if (user?.avatar) {
      setAvatar(user.avatar);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) return;

    setLoading(true);
    setError("");

    const newReview = {
      text,
      rating,
      useri: {
        username: user.username,
        profileImage: user.avatar || "",
        userId: user._id,
      },
    };

    try {
      // Аналіз настрою за допомогою Flask API
      const sentimentResponse = await fetch(
        "http://localhost:5000/api/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!sentimentResponse.ok) {
        throw new Error("Error analyzing sentiment");
      }

      const sentimentData = await sentimentResponse.json();
      const { sentiment } = sentimentData;

      // Додавання відгуку до бази даних
      const response = await fetch("http://localhost:3001/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...newReview, sentiment }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error adding review");
      }

      const savedReview = await response.json();
      addReview(savedReview);

      // Очищення полів форми
      setText("");
      setRating(5);
    } catch (error) {
      console.error("Error adding review:", error);
      setError(error.message || "Сталася помилка. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="review-form">
      {error && <p className="error-message">{error}</p>}
      <textarea
        placeholder="Напишіть свій відгук..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="review-textarea"
      />
      <div className="rating-container">
        <label htmlFor="rating" className="rating-label">
          Рейтинг:
        </label>
        <select
          name="rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="rating-select"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading} className="submit-button">
        {loading ? "Надсилання..." : "Додати відгук"}
      </button>
    </form>
  );
};

export default ReviewForm;
