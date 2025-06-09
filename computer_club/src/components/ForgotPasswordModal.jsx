// components/ForgotPasswordModal.jsx
import React, { useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import axios from "axios";

const ForgotPasswordModal = ({ active, setActive }) => {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await axios.post("http://localhost:3001/request-password-reset", {
        email,
      });
      setSuccess(true);
    } catch (err) {
      setError("Не вдалося надіслати лист. Перевірте email.");
      console.error(err);
    }
  };

  return (
    <Modal active={active} setActive={setActive}>
      <div className="vxid-modal">
        <p className="modal-name">Відновлення паролю</p>
        {success ? (
          <>
            <p className="vxid-modal register-succses">
              ✅ Лист для відновлення надіслано! <br /> Перевірте вашу пошту.
            </p>
            <Button onClick={() => setActive(false)}>Закрити</Button>
          </>
        ) : (
          <form className="modal-form" onSubmit={handleResetRequest}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введіть email"
              required
            />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <Button className="modal-button" type="submit">
              Надіслати лист
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ForgotPasswordModal;
