import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.base import BaseEstimator, ClassifierMixin

class ConstrainedLogisticRegression(BaseEstimator, ClassifierMixin):
    def __init__(self, C=1.0, class_weight=None, max_iter=1000, random_state=42, penalty='l2'):
        self.C = C
        self.class_weight = class_weight
        self.max_iter = max_iter
        self.random_state = random_state
        self.penalty = penalty
        self.base_model = LogisticRegression(
            C=self.C,
            class_weight=self.class_weight,
            max_iter=self.max_iter,
            random_state=self.random_state,
            solver='lbfgs' if penalty == 'l2' else 'liblinear',
            penalty=self.penalty
        )
        self.coef_ = None
        self.intercept_ = None
        self.classes_ = None

    def fit(self, X, y):
        self.base_model.fit(X, y)
        self.coef_ = self.base_model.coef_.copy()
        self.intercept_ = self.base_model.intercept_.copy()
        self.classes_ = self.base_model.classes_.copy()
        # Примусово робимо всі коефіцієнти невід’ємними
        self.coef_ = np.maximum(0, self.coef_)
        self.base_model.coef_ = self.coef_
        self.base_model.intercept_ = self.intercept_
        return self

    def predict(self, X):
        return self.base_model.predict(X)

    def predict_proba(self, X):
        return self.base_model.predict_proba(X)

    def score(self, X, y):
        return self.base_model.score(X, y)