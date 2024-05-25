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
  if (teams.length <= 1) return [teams];

  const pairs = [];
  for (let i = 0; i < teams.length; i += 2) {
    const team1 = teams[i];
    const team2 = teams[i + 1] || "BYE"; // Якщо непарна кількість команд
    pairs.push([team1, team2]);
  }

  return [pairs];
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

const TurnirBracket = ({ turnirs, handleWinnerSelect }) => (
  <div className="turnir-swiper-section">
    <div className="text-wrap-slider-turnir">
      <h3>
        Назва турніру: <span className="red-text">{turnirs[0].turnirName}</span>
      </h3>
      <p>
        Унікальний код турніру:{" "}
        <span className="red-text">{turnirs[0].uniqueCode}</span>
      </p>
    </div>
    <div className="wrap-table-turnir">
      {turnirs[0].pairs.map((round, roundIndex) => (
        <div key={roundIndex} className="turnir-round">
          {round.map(
            (pair, matchIndex) =>
              pair && (
                <div
                  key={`${roundIndex}-${matchIndex}`}
                  className="table-para-teams"
                >
                  <div className="table-one-team">
                    {pair[0] || `Team ${matchIndex * 2 + 1}`}
                  </div>
                  <div className="table-one-team table-winner-team">
                    <select
                      onChange={(e) =>
                        handleWinnerSelect(
                          0,
                          roundIndex,
                          matchIndex,
                          e.target.value
                        )
                      }
                      value={pair[2] || ""}
                    >
                      <option value="" disabled>
                        Winner
                      </option>
                      <option value={pair[0] || `Team ${matchIndex * 2 + 1}`}>
                        {pair[0] || `Team ${matchIndex * 2 + 1}`}
                      </option>
                      <option value={pair[1] || `Team ${matchIndex * 2 + 2}`}>
                        {pair[1] || `Team ${matchIndex * 2 + 2}`}
                      </option>
                    </select>
                  </div>
                  <div className="table-one-team">
                    {pair[1] || `Team ${matchIndex * 2 + 2}`}
                  </div>
                </div>
              )
          )}
        </div>
      ))}
    </div>
  </div>
);

export default function TurnirSection() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [turnirName, setTurnirName] = useState("");
  const [turnirUnikNum, setTurnirUnikNum] = useState("");
  const [turnirs, setTurnirs] = useState([]);
  const [createdTurnir, setCreatedTurnir] = useState(false);

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

  // Оновлений handleFindTurnir
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
      // Оновлення стану turnirs з використанням функції обновлення стану
      setTurnirs((prevTurnirs) => [
        ...prevTurnirs,
        { pairs, turnirName, uniqueCode },
      ]);
      // Додавання нового слайда після успішного знаходження турніру
      const swiperInstance = document.querySelector(".swiper-container").swiper;
      swiperInstance.slideNext();
    } catch (error) {
      alert(`Помилка при пошуку турніру: ${error.message}`);
    }
  };

  const handleWinnerSelect = (turnirIndex, roundIndex, matchIndex, winner) => {
    const updatedTurnirs = turnirs.map((turnir, index) => {
      if (index !== turnirIndex) return turnir;

      const updatedPairs = turnir.pairs.map((round, rIndex) => {
        if (rIndex < roundIndex) return round;

        if (rIndex === roundIndex) {
          const updatedRound = round.map((match, mIndex) => {
            if (mIndex !== matchIndex) return match;
            return [match[0], match[1], winner];
          });
          return updatedRound;
        }

        // Обчислити пари для наступного раунду
        const prevRound = updatedPairs[rIndex - 1];
        const nextRound = prevRound.reduce((acc, match, index) => {
          if (index % 2 === 0) {
            acc.push([match[2] || "", prevRound[index + 1]?.[2] || ""]);
          }
          return acc;
        }, []);
        return nextRound;
      });

      return { ...turnir, pairs: updatedPairs };
    });

    setTurnirs(updatedTurnirs);
  };

  const handleSaveTournament = async () => {
    try {
      await axios.post("http://localhost:3001/updateTurnir", {
        turnirs: turnirs[0],
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
        {createdTurnir && turnirs.length > 0 && (
          <SwiperSlide>
            <TurnirBracket
              turnirs={turnirs}
              handleWinnerSelect={handleWinnerSelect}
            />
          </SwiperSlide>
        )}
      </Swiper>
      {createdTurnir && (
        <Button onClick={handleSaveTournament} className="btn-save">
          Зберегти турнір
        </Button>
      )}
      {!isAuthenticated && (
        <div className="turnir-overlay">
          <h3 className="desabled-tip">
            Для доступу до турнірної сітки, вам потрібно авторизуватися
          </h3>
        </div>
      )}
    </div>
  );
}
