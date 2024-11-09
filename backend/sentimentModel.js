const tf = require("@tensorflow/tfjs"); // Використовуємо tfjs для Node.js
const { translate } = require("google-translate-open-api");
const fs = require("fs");

class SentimentModelWithFilter {
  constructor(modelPath, tokenizerPath, profanityFile) {
    // Завантажуємо модель
    this.model = tf.loadLayersModel(`file://${modelPath}`);

    // Завантажуємо токенайзер
    this.tokenizer = JSON.parse(fs.readFileSync(tokenizerPath, "utf-8"));

    // Параметри для токенізації
    this.maxlen = 200;

    // Завантажуємо список нецензурних слів
    this.loadProfanityList(profanityFile);
  }

  loadProfanityList(filePath) {
    this.profanityWords = new Set(
      fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean)
    );
  }

  async translateToEnglish(text) {
    const result = await translate(text, { tld: "com", to: "en" });
    return result.data[0];
  }

  async predictSentiment(text) {
    // Переклад на англійську
    const enText = await this.translateToEnglish(text);

    // Токенізація
    const tokenizedText = this.tokenizer.textsToSequences([enText]);
    const paddedText = tf
      .tensor(tokenizedText)
      .pad([[0, this.maxlen - tokenizedText[0].length]], 0);

    // Прогноз
    const prediction = this.model.predict(paddedText).dataSync()[0];
    return prediction > 0.5 ? "Positive" : "Negative";
  }

  blurProfanity(text) {
    // Заміняємо заборонені слова на "****"
    return text
      .split(" ")
      .map((word) =>
        this.profanityWords.has(word.toLowerCase()) ? "****" : word
      )
      .join(" ");
  }

  async classifyReview(text, rating) {
    // Спочатку фільтруємо текст від нецензурних слів
    const cleanedText = this.blurProfanity(text);

    // Отримуємо настрій відгуку
    const sentiment = await this.predictSentiment(cleanedText);

    // Враховуємо оцінку:
    // Якщо оцінка 5, але модель прогнозує "negative", то вважаємо "нейтральним"
    if (rating === 5 && sentiment === "Negative") {
      return "Neutral";
    }

    // Якщо оцінка менша за 5, то зберігаємо прогноз моделі
    return sentiment;
  }
}

module.exports = SentimentModelWithFilter;
