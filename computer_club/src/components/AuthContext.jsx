import React, { createContext, useState, useContext, useEffect } from "react";

// Створюємо новий контекст для стану авторизації
export const AuthContext = createContext();

// Створюємо власний компонент-провайдер для контексту авторизації
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Додаємо стан для користувача

  useEffect(() => {
    const storedIsAuthenticated =
      localStorage.getItem("isAuthenticated") === "true";
    const storedUser = localStorage.getItem("user");

    // Перевіряємо, чи є значення перед парсингом
    setIsAuthenticated(storedIsAuthenticated);
    setUser(storedUser ? JSON.parse(storedUser) : null);
  }, []);

  // Оновлюємо localStorage кожного разу, коли змінюється isAuthenticated або user
  useEffect(() => {
    localStorage.setItem("isAuthenticated", isAuthenticated);
    localStorage.setItem("user", JSON.stringify(user));
  }, [isAuthenticated, user]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, setIsAuthenticated, user, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Хук для отримання стану авторизації в будь-якому компоненті
export const useAuth = () => useContext(AuthContext);
