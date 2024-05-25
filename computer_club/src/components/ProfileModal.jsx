import React from "react";
import Modal from "./Modal";
import { useAuth } from "./AuthContext";

const ProfileModal = ({ active, setActive }) => {
  const { username } = useAuth();

  return (
    <Modal active={active} setActive={setActive}>
      <div className="profile-modal">
        <h2>Профіль користувача</h2>
        <p>Ім'я користувача: {username}</p>
        {/* Додайте більше інформації про користувача тут */}
      </div>
    </Modal>
  );
};

export default ProfileModal;
