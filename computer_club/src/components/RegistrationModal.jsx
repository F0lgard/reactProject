import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import axios from "axios";
import debounce from "lodash/debounce";
import { useAuth } from "./AuthContext";
import "../styles/RegisterModal.css";

const RegistrationModal = ({ active, setActive, setLoginActive }) => {
  const { setIsAuthenticated, setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usernameDirty, setUsernameDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [emailError, setEmailError] = useState("Емейл не може бути пустим");
  const [usernameError, setUsernameError] = useState(
    "Нікнейм не може бути пустим"
  );
  const [passwordError, setPasswordError] = useState(
    "Пароль не може бути пустим"
  );
  const [formValid, setFormValid] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false); // Додано стейт для успішної реєстрації

  useEffect(() => {
    if (usernameError || emailError || passwordError) {
      setFormValid(false);
    } else {
      setFormValid(true);
    }
  }, [usernameError, emailError, passwordError]);

  const blurHandler = (event) => {
    switch (event.target.name) {
      case "username":
        setUsernameDirty(true);
        break;
      case "email":
        setEmailDirty(true);
        break;
      case "password":
        setPasswordDirty(true);
        break;
    }
  };

  const checkUsernameExists = debounce(async (username) => {
    if (username) {
      try {
        const response = await axios.post(
          "http://localhost:3001/check-username",
          { username }
        );
        if (response.data.exists) {
          setUsernameError("Нікнейм вже зайнятий");
        }
      } catch (error) {
        console.error("Error checking username:", error);
      }
    }
  }, 500);

  const checkEmailExists = debounce(async (email) => {
    if (email) {
      try {
        const response = await axios.post("http://localhost:3001/check-email", {
          email,
        });
        if (response.data.exists) {
          setEmailError("Емейл вже зайнятий");
        }
      } catch (error) {
        console.error("Error checking email:", error);
      }
    }
  }, 500);

  const handleUsernameChange = (event) => {
    const username = event.target.value;
    setUsername(username);
    const reUsername = /^[a-zA-Z0-9_-]{3,16}$/;
    if (username.length < 3 || username.length > 16) {
      setUsernameError("Нікнейм має містити від 3 до 16 символів");
    } else if (!reUsername.test(username)) {
      setUsernameError("Нікнейм містить некоректні символи");
    } else {
      setUsernameError("");
      checkUsernameExists(username);
    }
  };

  const handleEmailChange = (event) => {
    const email = event.target.value;
    setEmail(email);
    const reEmail = String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
    if (!reEmail) {
      setEmailError("Некоректний емейл");
    } else {
      setEmailError("");
      checkEmailExists(email);
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    if (event.target.value.length < 8) {
      setPasswordError("Ваш пароль повинен містити щонайменше 8 символів");
    } else if (event.target.value.search(/[a-z]/i) < 0) {
      setPasswordError("Ваш пароль повинен містити принаймні одну літеру");
    } else if (event.target.value.search(/[0-9]/) < 0) {
      setPasswordError("Ваш пароль повинен містити хоча б одну цифру");
    } else {
      setPasswordError("");
    }
  };
  const handleRegistration = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post("http://localhost:3001/register", {
        username,
        email,
        password,
      });

      const userData = response.data;

      if (!userData.isVerified) {
        setRegistrationSuccess(true); // Показати повідомлення
        return; // Не логінити користувача поки не підтверджено пошту
      }

      // Якщо зареєстрований користувач чомусь вже підтверджений (що малоймовірно)
      setIsAuthenticated(true);
      setUser(userData);
      localStorage.setItem("isAuthenticated", true);
      localStorage.setItem("user", JSON.stringify(userData));

      setActive(false);
    } catch (error) {
      console.error("Помилка реєстрації:", error);
    }
  };

  const handleModalClose = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setUsernameDirty(false);
    setEmailDirty(false);
    setPasswordDirty(false);
    setEmailError("Емейл не може бути пустим");
    setUsernameError("Нікнейм не може бути пустим");
    setPasswordError("Пароль не може бути пустим");
    setFormValid(false);
    setRegistrationSuccess(false); // Забути про успішну реєстрацію при закритті модального вікна
    setActive(false);
    if (setLoginActive) {
      setLoginActive(true);
    }
  };

  return (
    <Modal
      active={active}
      setActive={() => {
        setActive(false);
        handleModalClose();
      }}
    >
      <div className="approve-modal">
        {registrationSuccess ? (
          <>
            <p className="modal-name-approve">Підтвердження пошти</p>
            <p className="register-succses">
              Реєстрація пройшла успішно. <br />
              Ми надіслали вам листа для підтвердження пошти. <br />
              Будь ласка, перевірте свою скриньку.
            </p>
            <Button
              onClick={handleModalClose}
              className="success-modal-Button-approve"
            >
              Закрити
            </Button>
          </>
        ) : (
          <form className="modal-form" method="POST">
            <p className="modal-name">РЕЄСТРАЦІЯ</p>
            {usernameDirty && usernameError && (
              <span style={{ color: "red", fontSize: "16px" }}>
                {usernameError}
              </span>
            )}
            <Input
              label="Username"
              name="username"
              type="input"
              id="username"
              value={username}
              onChange={handleUsernameChange}
              onBlur={(event) => blurHandler(event)}
              placeholder="Example: Nick"
            />
            {emailDirty && emailError && (
              <span style={{ color: "red", fontSize: "16px" }}>
                {emailError}
              </span>
            )}
            <Input
              label="Email"
              name="email"
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={(event) => blurHandler(event)}
              placeholder="Example: Nick@gmail.com"
            />
            {passwordDirty && passwordError && (
              <span style={{ color: "red", fontSize: "16px" }}>
                {passwordError}
              </span>
            )}
            <Input
              label="Password"
              name="password"
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={(event) => blurHandler(event)}
              placeholder="Example: Qwerty123"
            />
            <Button
              className="modal-button"
              onClick={handleRegistration}
              disabled={!formValid}
            >
              Зареєструватися
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default RegistrationModal;
