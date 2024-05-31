import React from "react";
import "../styles/Input.css";

const Input = ({
  label,
  type,
  id,
  value,
  onChange,
  name,
  onBlur,
  onFocus,
  placeholder,
}) => {
  return (
    <>
      <div className="form__group">
        <input
          type={type}
          className="form__field"
          placeholder={placeholder}
          name={name}
          id={id}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
          required
        />
        <label htmlFor={id} className="form__label">
          {label}
        </label>
      </div>
    </>
  );
};

export default Input;
