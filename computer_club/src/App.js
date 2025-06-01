// App.js
import "./styles/Normalize.css";
import "./styles/App.css";
import React, { useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import WelcomeSection from "./components/WelcomeSection";
import ZoneSection from "./components/ZoneSection";
import PricesSection from "./components/PricesSection";
import Footer from "./components/Footer";
import GamesSection from "./components/GamesSection";
import PronasSection from "./components/PronasSection";
import TurnirSection from "./components/TurnirSection";
import { AuthProvider } from "./components/AuthContext";
import ScrollToTopButton from "./components/ScrollToTopButton";
import { BookingsProvider } from "./components/BookingsContext";
import Reviews from "./components/Reviews/Reviews";
import MapSection from "./components/MapSection";
import Recommendations from "./components/Recommendations";
import { PriceProvider } from "./components/PriceContext";
import ChatbotComponent from "./components/ChatBot/ChatbotComponent";

function App() {
  const mapSectionRef = useRef(null);

  const handleScrollToMap = (deviceId, recommendedDuration) => {
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollToSection();
      mapSectionRef.current.openBookingModal(deviceId, recommendedDuration);
    }
  };

  return (
    <BrowserRouter>
      <PriceProvider>
        <AuthProvider>
          <BookingsProvider>
            <div className="App">
              <Header />
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <WelcomeSection />
                      <Recommendations onScrollToMap={handleScrollToMap} />
                      <ZoneSection />
                      <PricesSection />
                      <MapSection ref={mapSectionRef} />
                      {/*<ScrollToTopButton />*/}
                      <GamesSection />
                      <PronasSection />
                      <TurnirSection />
                      <Reviews />
                      <ChatbotComponent />
                    </>
                  }
                />
              </Routes>
              <Footer />
            </div>
          </BookingsProvider>
        </AuthProvider>
      </PriceProvider>
    </BrowserRouter>
  );
}

export default App;
