import "./styles/Normalize.css";
import "./styles/App.css";
import React, { useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import WelcomeSection from "./components/WelcomeSection";
import ZoneSection from "./components/ZoneSection";
import PricesSection from "./components/PricesSection";
import Footer from "./components/Footer";
import GamesSection from "./components/GamesSection";
import PronasSection from "./components/PronasSection";
import TurnirSection from "./components/TurnirSection";
import { AuthProvider } from "./components/AuthContext";
import { BookingsProvider } from "./components/BookingsContext";
import Reviews from "./components/Reviews/Reviews";
import MapSection from "./components/MapSection";
import Recommendations from "./components/Recommendations";
import { PriceProvider } from "./components/PriceContext";
import ChatbotComponent from "./components/ChatBot/ChatbotComponent";
import ResetPassword from "./components/ResetPassword";
import { Routes as RouterRoutes } from "react-router-dom";

const MainLayout = ({ children }) => {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <ChatbotComponent />
    </>
  );
};

const HomePage = ({ handleScrollToMap, mapSectionRef }) => (
  <>
    <WelcomeSection />
    <Recommendations onScrollToMap={handleScrollToMap} />
    <ZoneSection />
    <PricesSection />
    <MapSection ref={mapSectionRef} />
    <GamesSection />
    <PronasSection />
    {/*<TurnirSection />*/}
    <Reviews />
  </>
);

function App() {
  const mapSectionRef = useRef(null);
  const location = useLocation();

  const handleScrollToMap = (deviceId, recommendedDuration) => {
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollToSection();
      mapSectionRef.current.openBookingModal(deviceId, recommendedDuration);
    }
  };

  const isAuthRoute = location.pathname.startsWith("/reset-password");

  return (
    <PriceProvider>
      <AuthProvider>
        <BookingsProvider>
          <div className="App">
            <RouterRoutes>
              <Route
                path="/"
                element={
                  <MainLayout>
                    <HomePage
                      handleScrollToMap={handleScrollToMap}
                      mapSectionRef={mapSectionRef}
                    />
                  </MainLayout>
                }
              />
              <Route
                path="/reset-password/:token"
                element={<ResetPassword />}
              />
            </RouterRoutes>
          </div>
        </BookingsProvider>
      </AuthProvider>
    </PriceProvider>
  );
}

export default function WrappedApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
