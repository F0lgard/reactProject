import React from "react";
import "../styles/Modal.css"; // переконайся, що стилі підключені

const Modal = ({ active, setActive, children, customStyles = {} }) => {
  return (
    <div
      className={`modal ${active ? "active" : ""}`}
      onClick={() => setActive(false)}
    >
      <div
        className={`modal_content ${active ? "active" : ""}`}
        style={customStyles}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
