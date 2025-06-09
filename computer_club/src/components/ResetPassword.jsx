// filepath: src/pages/ResetPassword.jsx

import React, { useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams(); // Токен із URL
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();

    if (password !== repeatPassword) {
      setError("Паролі не збігаються");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/reset-password",
        {
          token,
          newPassword: password,
        }
      );

      setMessage(response.data.message);
      setError("");
      setTimeout(() => navigate("/"), 3000); // редирект через 3 сек
    } catch (err) {
      setError(err.response?.data?.message || "Помилка при скиданні паролю");
    }
  };

  return (
    <div className="reset-password-page">
      <h2>Скидання паролю</h2>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleReset}>
        <label>Новий пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label>Повторіть пароль</label>
        <input
          type="password"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          required
        />

        <button type="submit">Змінити пароль</button>
      </form>
    </div>
  );
};

export default ResetPassword;
