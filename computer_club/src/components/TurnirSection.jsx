import React, { useState } from "react";
import "../styles/Turnir.css";
import Button from "./Button";
import { useAuth } from "./AuthContext"; // Імпортуємо хук useAuth з файлу AuthContext.js
import axios from "axios";

export default function TurnirSection() {
  const { isAuthenticated } = useAuth(); // Використовуємо хук useAuth для отримання стану авторизації
  const [teams, setTeams] = useState([]);
  const [turnirName, setTurnirName] = useState("");
  const [turnirUnikNum, setTurnirUnikNum] = useState("");

  const handleCreateTurnir = async () => {
    // Перевірка, чи всі поля заповнені
    if (teams.length > 0 && turnirName.trim() !== "") {
      try {
        // Виконання запиту до сервера для створення турніру
        const response = await axios.post(
          "http://localhost:3001/createTurnir",
          { teams, turnirName }
        );
        const uniqueCode = response.data.uniqueCode;
        // Генеруємо пари команд
        const pairs = generatePairs(teams);
        // Оновлюємо вміст секції з турнірами
        updateTurnirSection(pairs);
        alert(`Турнір створено успішно! Унікальний код турніру: ${uniqueCode}`);
      } catch (error) {
        alert(`Помилка при створенні турніру: ${error.message}`);
      }
    } else {
      alert("Будь ласка, заповніть всі поля");
    }
  };

  const handleFindTurnir = async () => {
    // Логіка пошуку турніру за унікальним кодом
    try {
      // Виконання запиту до сервера для пошуку турніру за унікальним кодом
      const response = await axios.post("http://localhost:3001/findTurnir", {
        uniqueCode: turnirUnikNum,
      });
      const turnirData = response.data.turnirData;
      // Відображення інформації про знайдений турнір
      // Наприклад, ви можете відобразити таблицю з командами, які беруть участь в турнірі
    } catch (error) {
      alert(`Помилка при пошуку турніру: ${error.message}`);
    }
  };

  // Функція для генерації пар команд
  function generatePairs(teams) {
    const shuffledTeams = teams.sort(() => Math.random() - 0.5); // перемішуємо команди випадковим чином
    const pairs = [];
    for (let i = 0; i < shuffledTeams.length; i += 2) {
      pairs.push([shuffledTeams[i], shuffledTeams[i + 1]]);
    }
    return pairs;
  }

  function updateTurnirSection(pairs) {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    pairs.forEach((pair, index) => {
      const tr = document.createElement("tr");
      pair.forEach((team) => {
        const td = document.createElement("td");
        td.textContent = team;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    const turnirSection = document.getElementById("tournaments");
    turnirSection.innerHTML = ""; // Очищаємо вміст секції
    turnirSection.appendChild(table);
  }

  return (
    <div className="turnir-section" id="tournaments">
      <h2 className="turnir-section-name">Турнірна сітка</h2>
      <div className="content-wrap-turnir">
        <div className="text-wrap-turnir">
          <p>
            Впишіть через кому назви команд, які будуть брати участь в турнірі.
          </p>
          <p>
            <span className="red-text">Наприклад:</span> NAVI, KingBRO, Relikt,
            Zona
          </p>
          <input
            type="text"
            id="turnirInput"
            className="turnir-input"
            onChange={(e) => setTeams(e.target.value.split(","))}
          ></input>
          <div className="turnir-wrap-input">
            <div className="wraper-input-div">
              <div className="input-wrapped">
                <div className="input-content">
                  <h3>Назва турніру</h3>
                  <h4 className="sub-text-input">(ваш турнір, ваша назва)</h4>
                </div>
                <input
                  type="text"
                  id="turnirNameInput"
                  className="turnir-input-wrap"
                  onChange={(e) => setTurnirName(e.target.value)}
                />
              </div>
              <div className="input-wrapped">
                <div className="input-content">
                  <h3>Унікальний номер турніру</h3>
                  <h4 className="sub-text-input">
                    (для доступу до вже створених турнірів)
                  </h4>
                </div>
                <input
                  type="text"
                  id="turnirUnikNum"
                  className="turnir-input-wrap"
                  onChange={(e) => setTurnirUnikNum(e.target.value)}
                />
              </div>
            </div>
            <div className="button-wrapped">
              <Button onClick={handleCreateTurnir}>Створити</Button>
              <Button onClick={handleFindTurnir} className="btn-find">
                Знайти
              </Button>
            </div>
          </div>
        </div>
        <img
          src={require("../img/turnir.png")}
          className="turnir-img"
          alt="pro nas img"
          width="387px"
          height="480px"
        />
      </div>
      {/* Умовна логіка для відображення фонової заглушки */}
      {!isAuthenticated && (
        <div className="turnir-overlay">
          {/* <Button className="turnir-button-dis">Ввійти</Button> */}
          <h3 className="desabled-tip">
            Для доступу до турнірної сітки, вам потрібно авторизуватися
          </h3>
        </div>
      )}
    </div>
  );
}
