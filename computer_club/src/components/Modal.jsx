// filepath: f:\education_2024\reactProject\computer_club\src\components\Modal.jsx
import React from "react";

const Modal = ({ active, setActive, children, customStyles = {} }) => {
  return (
    <div
      className={active ? "modal active" : "modal"}
      onClick={() => setActive(false)}
    >
      <div
        className={active ? "modal_content active" : "modal_content"}
        style={customStyles} // Додаємо стилі з пропса
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
