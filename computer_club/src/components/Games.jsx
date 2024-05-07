import React, { useState, useEffect } from 'react';
import gamesData from '../games.json';
import '../styles/Games.css';

const Games = () => {
  const [pcGames, setPcGames] = useState([]);
  const [consoleGames, setConsoleGames] = useState([]);

  useEffect(() => {
    setPcGames(gamesData.pc);
    setConsoleGames(gamesData.console);
  }, []);

  return (
    <div className="games-container">
      <div className="games-section">
        <h2 className='games-section-name'>На ПК</h2>
        {pcGames.map((game, index) => (
          <div key={index} className="game-item">
            <img src={require(`../icons/${game.icon}`)} alt={game.name} />
            <span>{game.name}</span>
          </div>
        ))}
      </div>
      <div className="games-divider" />
      <div className="games-section">
        <h2 className='games-section-name'>На Консоль</h2>
        {consoleGames.map((game, index) => (
          <div key={index} className="game-item">
            <img src={require(`../icons/${game.icon}`)} alt={game.name} />
            <span>{game.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Games;
