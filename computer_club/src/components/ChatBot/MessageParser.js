class MessageParser {
  constructor(actionProvider) {
    this.actionProvider = actionProvider;
  }

  parse(message) {
    const lower = message.toLowerCase();

    if (lower.includes("бронювати")) {
      this.actionProvider.handleBooking();
    } else if (lower.includes("ціни")) {
      this.actionProvider.handlePrices();
    } else if (lower.includes("години") || lower.includes("працюєте")) {
      this.actionProvider.handleWorkingHours();
    } else if (lower.includes("про вас") || lower.includes("інформація")) {
      this.actionProvider.handleAbout();
    } else {
      this.actionProvider.handleMainMenu(); // показати меню якщо не впізнав
    }
  }
}

export default MessageParser;
