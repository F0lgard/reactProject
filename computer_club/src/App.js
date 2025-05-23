import React from "react";
import "./styles/Normalize.css";
import "./styles/App.css";
import Header from "./components/Header";
import WelcomeSection from "./components/WelcomeSection";
import ZoneSection from "./components/ZoneSection";
import PricesSection from "./components/PricesSection";
import Footer from "./components/Footer";
import GamesSection from "./components/GamesSection";
import PronasSection from "./components/PronasSection";
import TurnirSection from "./components/TurnirSection";
import { AuthProvider } from "./components/AuthContext"; // Імпортуємо AuthProvider з файлу AuthContext.js
import ScrollToTopButton from "./components/ScrollToTopButton";
import { BookingsProvider } from "./components/BookingsContext";
import Reviews from "./components/Reviews/Reviews";
import MapSection from "./components/MapSection";

function App() {
  return (
    <AuthProvider>
      <BookingsProvider>
        <div className="App">
          <Header />
          <WelcomeSection />
          <ZoneSection />
          <PricesSection />
          <MapSection />
          <ScrollToTopButton />
          <GamesSection />
          <PronasSection />
          <TurnirSection />
          <Reviews />
          <Footer />
        </div>
      </BookingsProvider>
    </AuthProvider>
  );
}

export default App;
