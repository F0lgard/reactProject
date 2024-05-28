import React, { useState } from "react";
import axios from "axios";
import "../styles/ChangePasswordForm.css";

const ChangePasswordForm = ({ user, setActive }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClose = () => {
    setActive(false); // Закриття форми зміни паролю
    // Очищення полів форми
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Перевірки на вимоги до пароля
    if (newPassword.length < 8) {
      setError("Ваш пароль повинен містити щонайменше 8 символів");
      return;
    } else if (newPassword.search(/[a-z]/i) < 0) {
      setError("Ваш пароль повинен містити принаймні одну літеру");
      return;
    } else if (newPassword.search(/[0-9]/) < 0) {
      setError("Ваш пароль повинен містити хоча б одну цифру");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Новий пароль та підтвердження пароля не співпадають.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/change-password",
        {
          userId: user._id,
          currentPassword,
          newPassword,
        }
      );

      if (response.data.success) {
        setSuccess("Пароль успішно змінено!");
        setError("");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(response.data.message);
        setSuccess("");
      }
    } catch (error) {
      setError("Сталася помилка при зміні пароля.");
      setSuccess("");
    }
  };

  return (
    <div className="overlay">
      <div className="change-password-form">
        <button className="close-button" onClick={handleClose}>
          ×
        </button>
        <h2>Зміна пароля</h2>
        <form onSubmit={handleChangePassword}>
          <label>
            Поточний пароль:
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Новий пароль:
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Підтвердження нового пароля:
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}
          <button type="submit">Змінити пароль</button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordForm;
