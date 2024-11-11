import React, { useState, useEffect } from "react";
import "./ReviewItem.css"; // Підключаємо CSS для стилів

const ReviewItem = ({ review, isAdmin, onDelete }) => {
  const [profileImage, setAvatar] = useState(
    review.useri?.profileImage || "http://localhost:3001/uploads/usericon.png"
  ); // Дефолтне фото

  useEffect(() => {
    // Оновлюємо аватар, коли review.useri.avatar змінюється або стає доступним
    if (review.useri?.profileImage) {
      setAvatar(review.useri.profileImage);
    }
  }, [review.useri]);

  return (
    <div className="review-item">
      {/* Виведення аватара та нікнейму в одному рядку */}
      <div className="review-header">
        <img
          src={profileImage} // Використовуємо локальний стан для аватарки
          alt="Avatar"
          className="user-avatar"
        />
        <h4 className="username">{review.useri.username}</h4>
      </div>

      {/* Виведення рейтингу */}
      <div className="review-rating">
        <p>Рейтинг: {review.rating}/5</p>
      </div>

      {/* Виведення тексту відгуку */}
      <div className="review-text">
        <p>{review.processedText}</p>
      </div>

      {/* Кнопка видалення доступна лише для адміністраторів */}
      {isAdmin && (
        <button onClick={() => onDelete(review._id)} className="delete-button">
          Видалити
        </button>
      )}
    </div>
  );
};

export default ReviewItem;
