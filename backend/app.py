from flask import Flask, request, jsonify
import tensorflow as tf
import joblib
from tensorflow.keras.preprocessing.sequence import pad_sequences
from better_profanity import profanity
from flask_cors import CORS
import os

print("Сервер запущено...")

class SentimentModelWithFilter:
    def __init__(self, model_path, tokenizer_path, profanity_file):
        self.model = tf.keras.models.load_model(model_path)
        with open(tokenizer_path, 'rb') as f:
            self.tokenizer = joblib.load(f)
        self.maxlen = 200
        self.load_profanity_list(profanity_file)

    def load_profanity_list(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            bad_words = [line.strip() for line in f if line.strip()]
        profanity.load_censor_words(bad_words)

    def blur_profanity(self, text):
        return profanity.censor(text)

    def predict_sentiment(self, text):
        en_text = text  # Використовуємо текст без перекладу
        tokenized_text = self.tokenizer.texts_to_sequences([en_text])
        padded_text = pad_sequences(tokenized_text, maxlen=self.maxlen)
        prediction = self.model.predict(padded_text)
        sentiment = "Positive" if prediction[0] > 0.5 else "Negative"

        if prediction[0] > 0.7:
            sentiment = "Positive"
        elif prediction[0] < 0.5:
            sentiment = "Negative"
        else:
            sentiment = "Neutral"

        processed_text = self.blur_profanity(text)
        return sentiment, processed_text

# Ініціалізація Flask API
app = Flask(__name__)
CORS(app)

# Ініціалізація моделі
model_path = "prediction-model/sentiment_model_amazon100k.h5"
tokenizer_path = "prediction-model/tokenizer_amazon100k.pkl"
profanity_file = "prediction-model/ukrainian-profanity.txt"
sentiment_model = SentimentModelWithFilter(model_path, tokenizer_path, profanity_file)

@app.route('/')
def home():
    return "API is running!"

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/api/analyze', methods=['POST'])
def predict():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Invalid input"}), 400

    text = data['text']
    sentiment, processed_text = sentiment_model.predict_sentiment(text)

    return jsonify({
        "original_text": text,
        "processed_text": processed_text,
        "sentiment": sentiment
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
