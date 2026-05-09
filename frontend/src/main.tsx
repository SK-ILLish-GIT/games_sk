import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import LeaderboardPage from './pages/LeaderboardPage';
import TicTacToePage from './pages/TicTacToePage';
import GuessNumberPage from './pages/GuessNumberPage';
import ArchitecturePage from './pages/ArchitecturePage';
import ProfilePage from './pages/ProfilePage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"             element={<HomePage />} />
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/register"     element={<RegisterPage />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/leaderboard"  element={<LeaderboardPage />} />
          <Route path="/tic-tac-toe"  element={<TicTacToePage />} />
          <Route path="/guess-number" element={<GuessNumberPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="*" element={
            <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
              <h1 style={{ fontSize: '4rem' }}>404</h1>
              <p>Page not found</p>
              <a href="/" className="btn btn-primary">Go Home</a>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
