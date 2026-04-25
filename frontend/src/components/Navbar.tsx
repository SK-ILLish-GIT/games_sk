import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const active = (path: string) => location.pathname === path ? 'active' : '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">🎮 GameVault</Link>
        <div className="navbar-links">
          <Link to="/" className={active('/')}>Home</Link>
          <Link to="/leaderboard" className={`hide-mobile ${active('/leaderboard')}`}>Leaderboard</Link>
          {user ? (
            <>
              <span style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
                👤 {user.username}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sign Out</button>
            </>
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
