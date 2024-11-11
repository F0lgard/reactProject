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

  const MIN_WORDS = 5; // Мінімальна кількість слів в відгуку

  // Функція для підрахунку кількості слів в тексті
  const countWords = (text) => {
    return text.trim().split(/\s+/).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (countWords(text) < MIN_WORDS) {
      setError(`Відгук повинен містити мінімум ${MIN_WORDS} слів.`);
      return;
    }

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
      const { sentiment, processed_text } = sentimentData; // Отримуємо processed_text з Flask

      // Додаємо processedText до об’єкта перед відправкою на сервер
      const response = await fetch("http://localhost:3001/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newReview,
          sentiment,
          processedText: processed_text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error adding review");
      }

      const savedReview = await response.json();
      addReview(savedReview);

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
