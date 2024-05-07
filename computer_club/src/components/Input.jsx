import React, { useState, useEffect } from 'react';
import '../styles/Input.css';

const Input = ({ label, type, id, value, onChange, name, onBlur, onFocus }) => {

  const [isEmpty, setIsEmpty] = useState(true);
  const [isActive, setIsActive] = useState(false);

  // const handleFocus = () => {
  //   setIsActive(true);
  // };

  // const handleBlur = () => {
  //   setIsActive(false);
  // };

  // useEffect(() => {
  //   if (isActive && value !== undefined) {
  //     setIsEmpty(value.trim() === '');
  //   }
  // }, [isActive, value]);

  // const handleInputChange = (event) => {
  //   onChange(event);
  //   setIsEmpty(event.target.value.trim() === '');
  // };

  return (
    <>
      <div className="form__group">
        <input
          type={type}
          className="form__field"
          placeholder="name"
          name={name}
          id={id}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
          required
        />
        <label htmlFor={id} className='form__label'>
          {label}
        </label>
      </div>
    </>
  );
};

export default Input;
