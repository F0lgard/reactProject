import React, { useState } from "react";
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

const generateTournamentBracket = (teams) => {
  if (teams.length <= 1) return [];

  const pairs = [];
  for (let i = 0; i < teams.length; i += 2) {
    const team1 = teams[i];
    const team2 = teams[i + 1] || "BYE"; // Якщо непарна кількість команд
    pairs.push({ team1, team2, winner: "" });
  }

  return pairs;
};

const TurnirInput = ({
  setTeams,
  setTurnirName,
  setTurnirUnikNum,
  handleCreateTurnir,
  handleFindTurnir,
}) => (
  <div className="content-wrap-turnir">
    <div className="text-wrap-turnir">
      <p>Впишіть через кому назви команд, які будуть брати участь в турнірі.</p>
      <p>
        <span className="red-text">Наприклад:</span> NAVI, KingBRO, Relikt, Zona
      </p>
      <input
        type="text"
        id="turnirInput"
        className="turnir-input"
        onChange={(e) =>
          setTeams(e.target.value.split(",").map((team) => team.trim()))
        }
      />
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
);

const TurnirBracket = ({
  turnirs,
  handleWinnerSelect,
  handleSaveTournament,
}) => {
  const currentTurnir = turnirs[0];

  return (
    <div className="turnir-swiper-section">
      <div className="text-wrap-slider-turnir">
        <h3>
          Назва турніру:{" "}
          <span className="red-text">{currentTurnir.turnirName}</span>
        </h3>
        <p>
          Унікальний код турніру:{" "}
          <span className="red-text">{currentTurnir.uniqueCode}</span>
        </p>
      </div>
      <div className="wrap-table-turnir">
        {currentTurnir.pairs &&
          Array.isArray(currentTurnir.pairs) &&
          currentTurnir.pairs.map((pair, matchIndex) => (
            <div key={matchIndex} className="table-para-teams">
              <div className="table-one-team">
                {pair.team1 || `Team ${matchIndex * 2 + 1}`}
              </div>
              <div className="table-one-team table-winner-team">
                {pair.winner ? (
                  <span>{pair.winner}</span>
                ) : (
                  <select
                    onChange={(e) =>
                      handleWinnerSelect(0, 0, matchIndex, e.target.value)
                    }
                    value={pair.winner}
                  >
                    <option value="" disabled>
                      Winner
                    </option>
                    <option value={pair.team1}>{pair.team1}</option>
                    <option value={pair.team2}>{pair.team2}</option>
                  </select>
                )}
              </div>
              <div className="table-one-team">
                {pair.team2 || `Team ${matchIndex * 2 + 2}`}
              </div>
            </div>
          ))}
      </div>
      <Button onClick={handleSaveTournament} className="btn-save">
        Зберегти зміни
      </Button>
    </div>
  );
};

export default function TurnirSection() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [turnirName, setTurnirName] = useState("");
  const [turnirUnikNum, setTurnirUnikNum] = useState("");
  const [turnirs, setTurnirs] = useState([]);
  const [createdTurnir, setCreatedTurnir] = useState(false);
  const { user, setUser } = useAuth();
  const handleCreateTurnir = async () => {
    if (teams.length > 0 && turnirName.trim() !== "") {
      try {
        const pairs = generateTournamentBracket(teams);
        const response = await axios.post(
          "http://localhost:3001/createTurnir",
          { pairs, turnirName }
        );
        const uniqueCode = response.data.uniqueCode;
        const newTurnir = { pairs, turnirName, uniqueCode };

        setCreatedTurnir(true);
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
    if (turnirUnikNum.trim() === "") {
      alert("Будь ласка, введіть унікальний номер турніру");
      return;
    }
    try {
      const response = await axios.post("http://localhost:3001/findTurnir", {
        uniqueCode: turnirUnikNum,
      });
      const turnirData = response.data.turnirData;
      const { pairs, turnirName, uniqueCode } = turnirData;

      console.log("Received pairs from server:", pairs);

      if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
        throw new Error("Некоректна структура даних для пар турніру");
      }

      setTurnirs((prevTurnirs) => [
        ...prevTurnirs,
        { pairs, turnirName, uniqueCode },
      ]);

      setCreatedTurnir(true);
    } catch (error) {
      alert(`Помилка при пошуку турніру: ${error.message}`);
    }
  };

  const handleWinnerSelect = (turnirIndex, roundIndex, matchIndex, winner) => {
    const updatedTurnirs = turnirs.map((turnir, index) => {
      if (index !== turnirIndex) return turnir;

      const updatedPairs = turnir.pairs.map((match, mIndex) => {
        if (mIndex !== matchIndex) return match;
        return { ...match, winner };
      });

      return { ...turnir, pairs: updatedPairs };
    });

    setTurnirs(updatedTurnirs);
  };

  const handleSaveTournament = async () => {
    try {
      await axios.post("http://localhost:3001/updateTurnir", {
        turnir: turnirs[0],
      });
      alert("Турнір успішно збережено!");
    } catch (error) {
      alert(`Помилка при збереженні турніру: ${error.message}`);
    }
  };

  return (
    <div className="turnir-section" id="tournaments">
      <h2 className="turnir-section-name">Турнірна сітка</h2>
      <Swiper
        style={{
          "--swiper-pagination-color": "#FF0000",
          "--swiper-pagination-bullet-inactive-color": "#ffffff",
          "--swiper-pagination-bullet-inactive-opacity": "1",
          "--swiper-pagination-bullet-size": "8px",
          "--swiper-pagination-bullet-width": "60px",
          "--swiper-pagination-bullet-height": "7px",
          "--swiper-pagination-bullet-border-radius": "0%",
          "--swiper-pagination-bullet-horizontal-gap": "17px",
          "--swiper-pagination-bullet-margin-top": "20px",
        }}
        className="swiper-container"
        spaceBetween={50}
        slidesPerView={1}
        pagination={{ clickable: true }}
      >
        <SwiperSlide>
          <TurnirInput
            setTeams={setTeams}
            setTurnirName={setTurnirName}
            setTurnirUnikNum={setTurnirUnikNum}
            handleCreateTurnir={handleCreateTurnir}
            handleFindTurnir={handleFindTurnir}
          />
        </SwiperSlide>
        {turnirs.map((turnir, index) => (
          <SwiperSlide key={index}>
            <TurnirBracket
              turnirs={[turnir]}
              handleWinnerSelect={handleWinnerSelect}
              handleSaveTournament={handleSaveTournament}
            />
          </SwiperSlide>
        ))}
      </Swiper>
      {isAuthenticated && user?.role === "admin" ? (
        // Ваш вміст для адмінів
        <div className="admin-content">
          <h3>Тільки для адміністраторів</h3>
          <p>Цей вміст доступний лише користувачам з роллю "адмін".</p>
        </div>
      ) : (
        <div className="turnir-overlay">
          <h3 className="desabled-tip">Coming soon...</h3>
        </div>
      )}
    </div>
  );
}
