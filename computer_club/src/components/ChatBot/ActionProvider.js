class ActionProvider {
  constructor(
    createChatBotMessage,
    setStateFunc,
    createClientMessage,
    ...rest
  ) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
    this.createClientMessage = createClientMessage;

    // Отримаємо priceTable з глобальної змінної
    this.priceTable = window.__clubPriceTable || {};
  }

  handleBooking() {
    const message = this.createChatBotMessage(
      "Щоб забронювати пристрій, натисніть на нього на карті, виберіть час і підтвердіть."
    );
    this.addMessageToState(message);
  }

  handlePrices() {
    if (!this.priceTable || Object.keys(this.priceTable).length === 0) {
      const message = this.createChatBotMessage(
        "Ціни наразі недоступні, спробуйте пізніше."
      );
      this.addMessageToState(message);
      return;
    }

    const priceText = Object.entries(this.priceTable)
      .map(([zone, prices]) => `• ${zone} – від ${prices[1]} грн/год`)
      .join("\n");

    const message = this.createChatBotMessage(`Ціни:\n${priceText}`);
    this.addMessageToState(message);
  }

  handleAbout() {
    const message = this.createChatBotMessage(
      "Ми — сучасний комп’ютерний клуб із топовим обладнанням 💻🎮"
    );
    this.addMessageToState(message);
  }

  handleWorkingHours() {
    const message = this.createChatBotMessage(
      "Ми працюємо щодня з 8:00 до 24:00 🕗"
    );
    this.addMessageToState(message);
  }

  handleDefault() {
    const message = this.createChatBotMessage(
      "Спробуйте запитати про ціни, бронювання або години роботи."
    );
    this.addMessageToState(message);
  }

  addMessageToState(message) {
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }
}

export default ActionProvider;
