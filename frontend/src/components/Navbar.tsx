import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ShinyText from './ui/ShinyText';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  const active = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          🎮 <ShinyText text="GameVault" speed={5} />
        </Link>
        <div className="navbar-links">
          <Link to="/" className={active('/')}>Home</Link>
          <Link to="/leaderboard" className={`hide-mobile ${active('/leaderboard')}`}>Leaderboard</Link>
          <Link to="/architecture" className={`hide-mobile ${active('/architecture')}`}>Architecture</Link>
          {user ? (
            <Link to="/profile" className={`btn btn-secondary btn-sm ${active('/profile')}`}>
              👤 {user.username}
            </Link>
          ) : (
            <>
              <Link to="/login" className={active('/login')}>Sign In</Link>
              <Link to="/register">
                <button className="btn btn-primary btn-sm">Join Free</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
