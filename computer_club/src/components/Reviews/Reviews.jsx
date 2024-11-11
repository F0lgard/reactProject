import React, { useState, useEffect } from "react";
import ReviewForm from "./ReviewForm";
import ReviewItem from "./ReviewItem";
import { useAuth } from "../AuthContext";
import "../../styles/Reviews.css";

const Reviews = () => {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 6;

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/reviews");
        const data = await response.json();

        // Сортуємо відгуки за сентиментом:
        const sortedReviews = data.sort((a, b) => {
          const sentimentOrder = {
            Positive: 1,
            Neutral: 2,
            Negative: 3,
          };
          return sentimentOrder[a.sentiment] - sentimentOrder[b.sentiment];
        });

        setReviews(sortedReviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };

    fetchReviews();
  }, []);

  const addReview = (newReview) => {
    const updatedReviews = [newReview, ...reviews].sort((a, b) => {
      const sentimentOrder = {
        Positive: 1,
        Neutral: 2,
        Negative: 3,
      };
      return sentimentOrder[a.sentiment] - sentimentOrder[b.sentiment];
    });
    setReviews(updatedReviews);
  };

  const lastReviewIndex = currentPage * reviewsPerPage;
  const firstReviewIndex = lastReviewIndex - reviewsPerPage;
  const currentReviews = reviews.slice(firstReviewIndex, lastReviewIndex);

  const handleNextPage = () => {
    if (lastReviewIndex < reviews.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Обчислюємо середній рейтинг
  const averageRating = reviews.length
    ? (
        reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
      ).toFixed(1)
    : 0;

  return (
    <div className="reviews" id="reviews">
      <h2 className="reviews-section-name">Відгуки</h2>
      <div className="reviews-v">
        {isAuthenticated ? (
          <ReviewForm addReview={addReview} />
        ) : (
          <p>Тільки авторизовані користувачі можуть писати відгуки.</p>
        )}
        <div className="reviews-list">
          {currentReviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
        <div className="pagination">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="pagination-button prev"
          >
            Попередня сторінка
          </button>
          <button
            onClick={handleNextPage}
            disabled={lastReviewIndex >= reviews.length}
            className="pagination-button next"
          >
            Наступна сторінка
          </button>
        </div>
      </div>

      {/* Виведення кількості відгуків і середнього рейтингу */}
      <div className="reviews-summary">
        <p>
          Загальна кількість відгуків: {reviews.length} <br />
          Середній рейтинг: {averageRating} / 5
        </p>
      </div>
    </div>
  );
};

export default Reviews;
