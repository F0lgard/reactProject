import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import logging
import os
import sys
import sklearn

logger = logging.getLogger(__name__)
logger.info(f"Версія sklearn: {sklearn.__version__}")

class NoShowPredictor:
    def __init__(self, model_type="random_forest"):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_dir = "trained_models"
        self.model_path = os.path.join(base_dir, model_dir, "model.pkl")
        self.scaler_path = os.path.join(base_dir, model_dir, "scaler.pkl")
        self.model_type = model_type
        self.threshold = 0.5
        
        self.model = None
        self.scaler = None
        self.is_trained = False

        if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
            try:
                self.load()
                logger.info("Модель і scaler успішно завантажено")
            except Exception as e:
                logger.error(f"Помилка завантаження: {str(e)}")
                self._initialize_new_model()
        else:
            logger.info("Модель або scaler не знайдено, ініціалізація нової моделі")
            self._initialize_new_model()

    def _initialize_new_model(self):
        self.model = RandomForestClassifier(
            random_state=42,
            class_weight='balanced',
            max_features='sqrt'
        )
        self.scaler = StandardScaler()
        self.is_trained = False

    def train(self, X, y):
        try:
            X_scaled = self.scaler.fit_transform(X)
            self.model.fit(X_scaled, y)
            self.is_trained = True
            feature_names = [
                "no_show_count", "cancel_rate", "completed_bookings",
                "booking_duration", "hour_category", "is_weekend", "zone_type"
            ]
            feature_importance = self.model.feature_importances_ * 100
            logger.info(f"Модель записана на {len(X)} прикладах")
            logger.info("Важливість ознак у відсотках:")
            for name, importance in zip(feature_names, feature_importance):
                logger.info(f"{name}: {importance:.2f}%")
        except Exception as e:
            logger.error(f"Помилка тренування: {str(e)}")
            raise

    def predict_proba(self, X):
        if not self.is_trained or self.model is None:
            logger.error("Модель не навчена")
            raise ValueError("Модель не навчена")
        try:
            X = np.array(X)
            if X.ndim == 1:
                X = X.reshape(1, -1)
            X_scaled = self.scaler.transform(X)
            probabilities = self.model.predict_proba(X_scaled)[:, 1]
            logger.info(f"Сирі ймовірності: {probabilities}")
            return probabilities
        except Exception as e:
            logger.error(f"Помилка прогнозування: {str(e)}")
            raise

    def predict(self, X):
        try:
            probabilities = self.predict_proba(X)
            return (probabilities >= self.threshold).astype(int)
        except Exception as e:
            logger.error(f"Помилка прогнозування: {str(e)}")
            raise

    def save(self):
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            with open(self.model_path, "wb") as f:
                pickle.dump(self.model, f)
            with open(self.scaler_path, "wb") as f:
                pickle.dump(self.scaler, f)
            logger.info(f"Модель збережено у {self.model_path}")
            logger.info(f"Scaler збережено у {self.scaler_path}")
        except Exception as e:
            logger.error(f"Помилка збереження: {str(e)}")
            raise

    def load(self):
        try:
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)
            with open(self.scaler_path, "rb") as f:
                self.scaler = pickle.load(f)
            self.is_trained = True
            logger.info(f"Модель завантажено з {self.model_path}")
            logger.info(f"Scaler завантажено з {self.scaler_path}")
        except Exception as e:
            logger.error(f"Помилка завантаження: {str(e)}")
            raise