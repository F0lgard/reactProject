import React, { createContext, useState, useContext, useEffect } from "react";

// Створюємо новий контекст для стану авторизації
export const AuthContext = createContext();

// Створюємо власний компонент-провайдер для контексту авторизації
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Додаємо стан для користувача

  // AuthContext.js
  useEffect(() => {
    const storedIsAuthenticated =
      localStorage.getItem("isAuthenticated") === "true";
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setIsAuthenticated(storedIsAuthenticated);
    setUser(storedUser);

    // console.log("User from localStorage:", storedUser); // Додайте це логування
  }, []);

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
