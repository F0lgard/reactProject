import React, { createContext, useState, useContext } from 'react';

// Створюємо новий контекст для стану авторизації
export const AuthContext = createContext();

// Створюємо власний компонент-провайдер для контексту авторизації
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    return (
        <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

// Хук для отримання стану авторизації в будь-якому компоненті
export const useAuth = () => useContext(AuthContext);
