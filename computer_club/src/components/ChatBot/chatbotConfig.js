// === Крок 1: Створимо ChatbotConfig з меню варіантів ===
// chatbotConfig.js

import { createChatBotMessage } from "react-chatbot-kit";

const config = {
  initialMessages: [
    createChatBotMessage(
      "Привіт! Я бот комп’ютерного клубу. Я можу допомогти з наступним:",
      {
        widget: "optionsMenu",
      }
    ),
  ],
  botName: "ClubBot",
  customStyles: {
    botMessageBox: { backgroundColor: "#f50057" },
    chatButton: { backgroundColor: "#f50057" },
  },
  widgets: [
    {
      widgetName: "optionsMenu",
      widgetFunc: (props) => (
        <div className="chatbot-options">
          <button
            onClick={() => props.actionProvider.handleBooking()}
            className="react-chatbot-kit-chat-btn"
          >
            Як забронювати?
          </button>
          <button
            onClick={() => props.actionProvider.handlePrices()}
            className="react-chatbot-kit-chat-btn"
          >
            Ціни
          </button>
          <button
            onClick={() => props.actionProvider.handleAbout()}
            className="react-chatbot-kit-chat-btn"
          >
            Про нас
          </button>
          <button
            onClick={() => props.actionProvider.handleWorkingHours()}
            className="react-chatbot-kit-chat-btn"
          >
            Години роботи
          </button>
        </div>
      ),
    },
  ],
};

export default config;
