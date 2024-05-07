// RegistrationModal.jsx
import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import axios from 'axios';

const RegistrationModal = ({ active, setActive }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usernameDirty, setUsernameDirty] = useState(false)
  const [emailDirty, setEmailDirty] = useState(false)
  const [passwordDirty, setPasswordDirty] = useState(false)
  const [emailError, setEmailError] = useState('Емейл не можe бути пустим')
  const [usernameError, setUsernameError] = useState('Нікнейм не можe бути пустим')
  const [passwordError, setPasswordError] = useState('Пароль не можe бути пустим')
  const [formValid, setFormValid] = useState(false)
  useEffect (() => {
    if (usernameError || emailError || passwordError) {
        setFormValid(false)
    } else {
        setFormValid(true)
    }
  }, [usernameError, emailError, passwordError])
  const blurHandler = (event) => {
    switch (event.target.name) {
        case 'username': 
            setUsernameDirty(true)
            break
        case 'email': 
            setEmailDirty(true)
            break
        case 'password': 
            setPasswordDirty(true)
            break
    }
  } 

  const handleUsernameChange = (event) => {
    const username = event.target.value;
    setUsername(username);
    const reUsername = /^[a-zA-Z0-9_-]{3,16}$/; // Регулярний вираз для валідації користувацького імені
    if (username.length < 3 || username.length > 16) {
      setUsernameError('Нікнейм має містити від 3 до 16 символів');
    } else if (!reUsername.test(username)) {
      setUsernameError('Нікнейм містить некоректні символи');
    } else {
      setUsernameError('');
    }
  };
  

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
    const reEmail = String(event.target.value)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
    if(!reEmail) {
        setEmailError('Некоректний емейл');

    } else {
        setEmailError('')
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);

    if (event.target.value.length < 8) {
        setPasswordError("Ваш пароль повинен містити щонайменше 8 символів"); 
    }
    else if (event.target.value.search(/[a-z]/i) < 0) {
        setPasswordError("Ваш пароль повинен містити принаймні одну літеру");
    }
    else if (event.target.value.search(/[0-9]/) < 0) {
        setPasswordError("Ваш пароль повинен містити хоча б одну цифру"); 
    }
    else {
        setPasswordError('')
    }
  };

  const handleRegistration = async (event) => {
    event.preventDefault(); // Зупиняємо стандартну поведінку форми
      try {
          const response = await axios.post('http://localhost:3001/register', { username, email, password });
          alert('Registration successful:');
          // Додаткові дії після успішної реєстрації, наприклад, перенаправлення на іншу сторінку
      } catch (error) {
          alert('Registration failed:');
          console.log(error)
          // alert(error.response.data);
      }
  };


  const handleModalClose = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setUsernameDirty(false);
    setEmailDirty(false);
    setPasswordDirty(false);
    setEmailError('Емейл не може бути пустим');
    setUsernameError('Нікнейм не може бути пустим');
    setPasswordError('Пароль не може бути пустим');
    setFormValid(false);
};


  return (
    <Modal active={active} setActive={() => { setActive(false); handleModalClose(); }}>
      <>
        <p className="modal-name">РЕЄСТРАЦІЯ</p>
        <form className="modal-form" method='POST'>
          {(usernameDirty && usernameError) && <span style={{color: 'red'}}>{usernameError}</span>}
          <Input label="Username" name="username" type="input" id="username" value={username} onChange={handleUsernameChange} onBlur={event => blurHandler(event)}/>
          {(emailDirty && emailError) && <span style={{color: 'red'}}>{emailError}</span>}
          <Input label="Email" name="email" type="email" id="email" value={email} onChange={handleEmailChange} onBlur={event => blurHandler(event)}/>
          {(passwordDirty && passwordError) && <span style={{color: 'red'}}>{passwordError}</span>}
          <Input label="Password" name="password" type="password" id="password" value={password} onChange={handlePasswordChange} onBlur={event => blurHandler(event)}/>
          <Button className="modal-button" onClick={handleRegistration} disabled={!formValid}>Зареєструватися</Button>
        </form>
      </>
    </Modal>
  );
};

export default RegistrationModal;
