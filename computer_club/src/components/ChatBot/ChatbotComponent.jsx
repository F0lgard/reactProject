import React, { useState } from "react";
import Chatbot from "react-chatbot-kit";
import "react-chatbot-kit/build/main.css";
import config from "./chatbotConfig";
import MessageParser from "./MessageParser";
import ActionProvider from "./ActionProvider";
import "../../styles/Chatbot.css";
import { ReactComponent as ChatIcon } from "../../img/chat.svg";
import { usePrice } from "../PriceContext";

const ChatbotComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const priceTable = usePrice();

  console.log("ChatbotComponent priceTable:", priceTable); // Дебаг
  window.__clubPriceTable = priceTable;

  return (
    <div className="chatbot-container">
      {isOpen ? (
        <div className="chatbot-box">
          <div className="chatbot-header">
            <span className="chatbot-title">ClubBot</span>
            <button
              className="chatbot-close-btn"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <Chatbot
            config={config}
            messageParser={MessageParser}
            actionProvider={ActionProvider}
          />
        </div>
      ) : (
        <button className="chat-toggle-icon" onClick={() => setIsOpen(true)}>
          <ChatIcon width={28} height={28} />
        </button>
      )}
    </div>
  );
};

export default ChatbotComponent;
