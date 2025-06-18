// components/Header.js

import React, { useState, useEffect } from "react";
import Button from "./Button";
import Modal from "./Modal";
import RegistrationModal from "./RegistrationModal";
import ProfileModal from "./ProfileModal";
import Input from "./Input";
import axios from "axios";
import { useAuth } from "./AuthContext";
import AdminAnalytics from "./Admin/AdminAnalytics";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function Header() {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = useAuth();
  const [loginModalActive, setLoginModalActive] = useState(false);
  const [registrationModalActive, setRegistrationModalActive] = useState(false);
  const [profileModalActive, setProfileModalActive] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isAnalyticsOpen, setAnalyticsOpen] = useState(false);
  const [forgotModalActive, setForgotModalActive] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    const storedIsAuthenticated =
      localStorage.getItem("isAuthenticated") === "true";
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setIsAuthenticated(storedIsAuthenticated);
    setUser(storedUser);
  }, [setIsAuthenticated, setUser]);

  const handleRegistrationLinkClick = () => {
    setLoginModalActive(false);
    setRegistrationModalActive(true);
  };

  const handleLoginChange = (event) => {
    setLogin(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://localhost:3001/login", {
        login,
        password,
      });

      const userData = response.data;
      setLoginModalActive(false);
      setIsAuthenticated(true);
      localStorage.setItem("isAuthenticated", true);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setError("");
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) {
          setError("Невірний логін або пароль.");
        } else if (error.response.status === 403) {
          setError(
            "Будь ласка, підтвердіть свою електронну пошту перед входом."
          );
          setShowResendVerification(true); // показати кнопку
        } else if (error.response.status === 404) {
          setError("Користувача не знайдено.");
        } else {
          setError("Сталася помилка під час авторизації.");
        }
      } else {
        setError("Помилка з'єднання з сервером.");
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
  };

  const [avatar, setAvatar] = useState(
    user?.avatar || "http://localhost:3001/uploads/usericon.png"
  ); // Дефолтне фото

  useEffect(() => {
    // Оновлюємо аватар, коли user.avatar змінюється або стає доступним
    if (user?.avatar) {
      setAvatar(user.avatar);
    }
  }, [user]);

  const handleResendVerification = async () => {
    if (!login.includes("@")) {
      setResendMessage("Будь ласка, введіть email, а не логін.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3001/resend-verification",
        {
          email: login.trim(),
        }
      );
      setResendMessage("Лист повторно надіслано 📧");
    } catch (err) {
      setResendMessage("Не вдалося надіслати лист. Спробуйте пізніше.");
      console.error(err);
    }
  };

  return (
    <div>
      <header className="header">
        <div className="logo">
          <a href="/">
            <img
              src={require("../img/logo.png")}
              alt="logo"
              width="139px"
              height="84px"
            />
          </a>
        </div>
        <nav className="navigation">
          <ul>
            <li>
              <a href="#zoneSection">Зони</a>
            </li>
            <li>
              <a href="#prices">Ціни</a>
            </li>
            <li>
              <a href="#map">Карта</a>
            </li>
            <li>
              <a href="#games">Ігри</a>
            </li>
            <li>
              <a href="#about">Про нас</a>
            </li>
            <li>
              <a href="#reviews">Відгуки</a>
            </li>
          </ul>
        </nav>
        {isAuthenticated && user ? (
          <div className="user-info">
            {user?.role === "admin" && (
              <button
                className="admin-panel-btn"
                onClick={() => setAnalyticsOpen(true)}
              >
                Адмін панель
              </button>
            )}

            <div
              className="user-info-container"
              onClick={() => setProfileModalActive(true)}
              style={{ cursor: "pointer" }}
            >
              <img
                src={avatar}
                alt="account"
                width="35px"
                height="35px"
                className="user-avatar"
              />
              <span className="usernameh">{user.username}</span>
            </div>
            <Button className="button-logout" onClick={handleLogout}>
              Вийти
            </Button>
          </div>
        ) : (
          <Button
            className="button-login"
            onClick={() => setLoginModalActive(true)}
          >
            Ввійти
          </Button>
        )}
        <Modal active={loginModalActive} setActive={setLoginModalActive}>
          <div className="vxid-modal">
            <p className="modal-name">ВХІД</p>
            <form className="modal-form" method="POST">
              <Input
                label="Login or Email"
                type="input"
                id="login"
                value={login}
                onChange={handleLoginChange}
                placeholder="Example: Nick or email@example.com"
              />
              <Input
                label="Password"
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Example: Qwerty123"
              />
              {error && <p className="error-message">{error}</p>}
              <button className="modal-button" onClick={handleLogin}>
                Ввійти
              </button>
              {showResendVerification && (
                <div className="resend-verification">
                  <button
                    type="button"
                    className="modal-a resend-link"
                    onClick={handleResendVerification}
                  >
                    Надіслати лист підтвердження повторно
                  </button>
                  {resendMessage && (
                    <p style={{ color: "green", fontSize: "14px" }}>
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
            </form>
            <div className="modal-section-a">
              <a
                href="#"
                className="modal-a"
                onClick={() => {
                  setLoginModalActive(false);
                  setForgotModalActive(true);
                }}
              >
                Забули пароль
              </a>

              <a
                href="#"
                className="modal-a"
                onClick={handleRegistrationLinkClick}
              >
                Реєстрація
              </a>
            </div>
          </div>
        </Modal>
        <RegistrationModal
          active={registrationModalActive}
          setActive={setRegistrationModalActive}
        />
        <ForgotPasswordModal
          active={forgotModalActive}
          setActive={setForgotModalActive}
        />

        <ProfileModal
          active={profileModalActive}
          setActive={setProfileModalActive}
        />
        {isAnalyticsOpen && (
          <div
            className="admin-panel-overlay"
            onClick={() => setAnalyticsOpen(false)}
          >
            <div
              className="admin-panel-content"
              onClick={(e) => e.stopPropagation()}
            >
              <AdminAnalytics setAnalyticsOpen={setAnalyticsOpen} />
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
