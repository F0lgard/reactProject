import React, { useState, useEffect } from "react";
import Button from "./Button";
import Modal from "./Modal";
import RegistrationModal from "./RegistrationModal";
import ProfileModal from "./ProfileModal"; // Імпортуйте ProfileModal
import Input from "./Input";
import axios from "axios";
import { useAuth } from "./AuthContext";

export default function Header() {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = useAuth();
  const [loginModalActive, setLoginModalActive] = useState(false);
  const [registrationModalActive, setRegistrationModalActive] = useState(false);
  const [profileModalActive, setProfileModalActive] = useState(false); // Додайте стан для профілю
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

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
      const userData = response.data; // Отримання даних користувача з відповіді сервера
      alert(`Ви успішно авторизувалися, ${userData.username}!`);
      setLoginModalActive(false);
      setIsAuthenticated(true); // Встановлення стану авторизації в компоненті
      localStorage.setItem("isAuthenticated", true); // Збереження стану авторизації в localStorage
      localStorage.setItem("user", JSON.stringify(userData)); // Збереження даних користувача в localStorage
      setUser(userData); // Оновлення стану змінної user
    } catch (error) {
      alert(`Помилка під час авторизації: ${error.message}`);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false); // Встановлення стану авторизації в компоненті
    setUser(null); // Очищення даних користувача
    localStorage.removeItem("isAuthenticated"); // Видалення збереженого стану авторизації з localStorage
    localStorage.removeItem("user"); // Видалення збережених даних користувача з localStorage
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
              <a href="#games">Ігри</a>
            </li>
            <li>
              <a href="#about">Про нас</a>
            </li>
            <li>
              <a href="#tournaments">Турніри</a>
            </li>
          </ul>
        </nav>
        {/* Відображення імені користувача та кнопки Вийти */}
        {isAuthenticated && user ? (
          <div className="user-info">
            <a
              href="#"
              className="a-user-info"
              onClick={() => setProfileModalActive(true)} // Додайте обробник для відкриття модального вікна
            >
              <img
                src={require("../img/Account.png")}
                alt="account"
                width="35px"
                height="35px"
              />
            </a>
            <span className="username">{user.username}</span>
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
                label="Login"
                type="input"
                id="login"
                value={login}
                onChange={handleLoginChange}
              />
              <Input
                label="Password"
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
              />
              <button className="modal-button" onClick={handleLogin}>
                Ввійти
              </button>
            </form>
            <div className="modal-section-a">
              <a href="/" className="modal-a">
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
        <ProfileModal
          active={profileModalActive} // Активний стан для ProfileModal
          setActive={setProfileModalActive} // Метод для закриття ProfileModal
        />
      </header>
    </div>
  );
}
