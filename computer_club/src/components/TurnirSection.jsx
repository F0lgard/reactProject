import React, { useState, useEffect } from "react";
import "../styles/Turnir.css";
import Button from "./Button";
import { useAuth } from "./AuthContext";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import SwiperCore from "swiper";
import { Pagination } from "swiper/modules";
import "swiper/swiper-bundle.css";
import "swiper/css/bundle";

SwiperCore.use([Pagination]);

export default function TurnirSection() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [turnirName, setTurnirName] = useState("");
  const [turnirUnikNum, setTurnirUnikNum] = useState("");
  const [turnirs, setTurnirs] = useState([]);
  const [createdTurnir, setCreatedTurnir] = useState(false); // Додавання стану для відстеження створеного турніру

  // Оголошуємо функцію fetchTurnirs поза useEffect
  const fetchTurnirs = async () => {
    try {
      const response = await axios.get("http://localhost:3001/turnirs");
      console.log(response);
      setTurnirs(response.data);
    } catch (error) {
      console.error("Помилка завантаження турнірів:", error);
    }
  };

  useEffect(() => {
    // Запускаємо fetchTurnirs лише раз при монтажі компонента
    fetchTurnirs();
  }, []);

  const handleCreateTurnir = async () => {
    if (teams.length > 0 && turnirName.trim() !== "") {
      try {
        const pairs = generatePairs(teams);
        console.log(pairs);

        const formattedPairs = pairs.map((pair) => ({
          team1: pair[0],
          team2: pair[1],
        }));

        const response = await axios.post(
          "http://localhost:3001/createTurnir",
          { pairs: formattedPairs, turnirName }
        );
        const uniqueCode = response.data.uniqueCode;
        const newTurnir = { pairs, turnirName, uniqueCode };

        setCreatedTurnir(true); // Встановлення стану створеного турніру

        setTurnirs([newTurnir]);

        alert(`Турнір створено успішно! Унікальний код турніру: ${uniqueCode}`);
      } catch (error) {
        alert(`Помилка при створенні турніру: ${error.message}`);
      }
    } else {
      alert("Будь ласка, заповніть всі поля");
    }
  };

  const handleFindTurnir = async () => {
    try {
      const response = await axios.post("http://localhost:3001/findTurnir", {
        uniqueCode: turnirUnikNum,
      });
      const turnirData = response.data.turnirData;
      const { pairs, turnirName, uniqueCode } = turnirData;
      const newTurnir = { pairs, turnirName, uniqueCode };
      setTurnirs([...turnirs, newTurnir]);
    } catch (error) {
      alert(`Помилка при пошуку турніру: ${error.message}`);
    }
  };

  function generatePairs(teams) {
    const shuffledTeams = teams.sort(() => Math.random() - 0.5);
    const pairs = [];
    for (let i = 0; i < shuffledTeams.length; i += 2) {
      pairs.push([shuffledTeams[i], shuffledTeams[i + 1]]);
    }
    return pairs;
  }
  return (
    <div className="turnir-section" id="tournaments">
      <h2 className="turnir-section-name">Турнірна сітка</h2>
      <Swiper
        style={{
          "--swiper-pagination-bullet-inactive-color": "#ffffff",
        }}
        className="swiper-container"
        spaceBetween={50}
        slidesPerView={1}
        pagination={{ clickable: true }}
      >
        <SwiperSlide>
          <div className="content-wrap-turnir">
            <div className="text-wrap-turnir">
              <p>
                Впишіть через кому назви команд, які будуть брати участь в
                турнірі.
              </p>
              <p>
                <span className="red-text">Наприклад:</span> NAVI, KingBRO,
                Relikt, Zona
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
                      <h4 className="sub-text-input">
                        (ваш турнір, ваша назва)
                      </h4>
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
        </SwiperSlide>
        {createdTurnir && (
          <>
            {turnirs.map((turnir, index) => (
              <SwiperSlide key={index}>
                <div className="turnir-swiper-section">
                  <div className="text-wrap-slider-turnir">
                    <h3>
                      Назва турніру:{" "}
                      <span className="red-text">{turnir.turnirName}</span>
                    </h3>
                    <p>
                      Унікальний код турніру:{" "}
                      <span className="red-text">{turnir.uniqueCode}</span>
                    </p>
                  </div>
                  <table className="turnir-table">
                    <tbody>
                      {turnir.pairs.map((pair, index) => (
                        <tr key={index}>
                          <td>{pair[0]}</td>
                          <td>{pair[1]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SwiperSlide>
            ))}
          </>
        )}
      </Swiper>
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
