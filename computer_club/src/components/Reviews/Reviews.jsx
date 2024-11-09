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
        // 1. Позитивні ("Positive") йдуть першими
        // 2. Нейтральні ("Neutral") йдуть після позитивних
        // 3. Негативні ("Negative") йдуть останніми
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
    // Додаємо новий відгук в початок списку та сортуємо за сентиментом
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
    </div>
  );
};

export default Reviews;
