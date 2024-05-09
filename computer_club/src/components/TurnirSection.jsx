import React from 'react';
import '../styles/Turnir.css';
import Button from './Button';
import { useAuth } from './AuthContext'; // Імпортуємо хук useAuth з файлу AuthContext.js

export default function TurnirSection() {
    const { isAuthenticated } = useAuth(); // Використовуємо хук useAuth для отримання стану авторизації

    return (
        <div className='turnir-section' id='tournaments'>
            <h2 className='turnir-section-name'>Турнірна сітка</h2>
            <div className='content-wrap-turnir'>
                <div className='text-wrap-turnir'>
                    <p>Впишіть через кому назви команд, які будуть брати участь в турнірі.</p>
                    <p><span className='red-text'>Наприклад:</span> NAVI, KingBRO, Relikt, Zona</p>
                    <input type='text' id='turnirInput' className='turnir-input'></input>
                    <Button>Створити</Button>
                </div>
                <img src={require('../img/turnir.png')} className='turnir-img' alt='pro nas img' width='387px' height='480px' />
            </div>
            {/* Умовна логіка для відображення фонової заглушки */}
            {!isAuthenticated && (
                <div className='turnir-overlay'>
                    {/* <Button className="turnir-button-dis">Ввійти</Button> */}
                    <h3 className='desabled-tip'>Для доступу до турнірної сітки, вам потрібно авторизуватися</h3>
                </div>
            )}
        </div>
    );
}
