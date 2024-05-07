import Button from "./Button";
import { useState } from 'react';
import Modal from './Modal'
import RegistrationModal from "./RegistrationModal";
import Input from './Input'
import axios from 'axios';

export default function Header() {
    const [loginModalActive, setLoginModalActive] = useState(false);
    const [registrationModalActive, setRegistrationModalActive] = useState(false);
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState()

    const handleRegistrationLinkClick = () => {
        setLoginModalActive(false);
        setRegistrationModalActive(true);
      };
      
    function handleLoginChange(event) {
        console.log(event.target.value)
        setLogin(event.target.value)
    }

    function handlePasswordChange(event) {
        console.log(event.target.value)
        setPassword(event.target.value)
    }

    const handleLogin = async (e) => {
        e.preventDefault();
    
        try {
          const response = await axios.post('http://localhost:3001/login', { login, password });
          alert('Ви успішно авторизувалися:');
          // Тут можна додатково обробляти відповідь сервера, наприклад, зберігати токен доступу у стані додатку
        } catch (error) {
          alert(`Помилка під час авторизації:${error.message}`);
        }
      };

    return (
    <div>
        <header className='header'>
            <div className='logo'>
                <a href='/'>
                    <img src={require('../img/logo.png')} alt='logo' width='139px' height='84px'/>
                </a>
            </div>
            {/* <div class="icons">
                <a href="#"><img src={require("../img/Instagram.png")} alt="Іконка Instagram" /></a>
                <a href="#"><img src={require("../img/Steam.png")} alt="Іконка Steam" /></a>
            </div> */}
            <nav className='navigation'>
                <ul>
                    <li><a href="#zoneSection">Зони</a></li>
                    <li><a href="#prices">Ціни</a></li>
                    <li><a href="#games">Ігри</a></li>
                    <li><a href="#about">Про нас</a></li>
                    <li><a href="#tournaments">Турніри</a></li>
                </ul>
            </nav>
            <Button className="button-login" onClick={() => setLoginModalActive(true)}>Ввійти</Button>
            <Modal active={loginModalActive} setActive={setLoginModalActive}>
                <>
                    <p className="modal-name">ВХІД</p>
                        <form className="modal-form" method='POST'>
                            <Input label = "Login" type="input" id="login" value={login} onChange={handleLoginChange}/>
                            <Input label = "Password" type="password" id="password" value={password} onChange={handlePasswordChange}/>
                            <button className="modal-button" onClick={handleLogin}>Ввійти</button>
                        </form>
                    <div className="modal-section-a">
                    <a href="/" className="modal-a">Забули пароль</a>
                    <a href="#" className="modal-a" onClick={handleRegistrationLinkClick}>Реєстрація</a>
                    </div>
                </>
            </Modal>
            <RegistrationModal active={registrationModalActive} setActive={setRegistrationModalActive} />
        </header>
    </div>
    )
};