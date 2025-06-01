import React from "react";
import "../styles/card.css"; // якщо хочеш окремі стилі

export const Card = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-white shadow-md rounded-lg p-4 mb-4 ${className}`}
      style={{ border: "1px solid #ddd" }}
    >
      {children}
    </div>
  );
};

export const CardContent = ({ children }) => {
  return <div className="card-content">{children}</div>;
};
