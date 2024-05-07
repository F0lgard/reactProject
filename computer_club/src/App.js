//import React, { useState } from 'react';
import './styles/Normalize.css';
import './styles/App.css';
import Header from "./components/Header";
import WelcomeSection from './components/WelcomeSection';
import ZoneSection from './components/ZoneSection';
import PricesSection from './components/PricesSection';
import Footer from './components/Footer';
import GamesSection from './components/GamesSection';
import PronasSection from './components/PronasSection';

function App() {

  return (
    <div className="App">
    <Header/> 
    <WelcomeSection/>
    <ZoneSection/>
    <PricesSection/>
    <GamesSection/>
    <PronasSection/>
    <Footer/>
    </div>
  );
}

export default App;
