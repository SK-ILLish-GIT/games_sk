import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/client';
import SpotlightCard from '../components/ui/SpotlightCard';
import ShinyText from '../components/ui/ShinyText';
import Squares from '../components/ui/Squares';

/* ── Validation helpers ──────────────────────────────────────────── */
function validateUsername(value: string): string | null {
  if (!value.trim()) return 'Username is required';
  if (value.trim().length < 3) return 'Username must be at least 3 characters';
  if (value.trim().length > 30) return 'Username must be 30 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return 'Only letters, numbers, and underscores';
  return null;
}

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address';
  return null;
}

/* ── Profile Page ────────────────────────────────────────────────── */
export default function ProfilePage() {
  const { user, loading: authLoading, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string }>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Sync form state with user data
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email || '');
    }
  }, [user]);

  // Redirect unauthenticated users (after auth loading completes)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setError('');
    setSuccess('');
    setFieldErrors({});
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    if (user) {
      setUsername(user.username);
      setEmail(user.email || '');
    }
    setError('');
    setSuccess('');
    setFieldErrors({});
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    const usernameErr = validateUsername(username);
    const emailErr = validateEmail(email);
    if (usernameErr || emailErr) {
      setFieldErrors({ username: usernameErr ?? undefined, email: emailErr ?? undefined });
      return;
    }
    setFieldErrors({});

    if (!user) return;

    // Check for actual changes
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    if (trimmedUsername === user.username && trimmedEmail === (user.email || '')) {
      setError('No changes detected');
      return;
    }

    setSaving(true);
    try {
      const payload: { username?: string; email?: string } = {};
      if (trimmedUsername !== user.username) payload.username = trimmedUsername;
      if (trimmedEmail !== (user.email || '')) payload.email = trimmedEmail;

      await updateProfile(payload);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Logout failed. Please try again.'));
      setLoggingOut(false);
    }
  };

  // Show spinner while auth state loads
  if (authLoading) {
    return (
      <div className="page">
        <div className="container flex-center" style={{ minHeight: '50vh' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Guard: user must be authenticated
  if (!user) return null;

  const userInitial = user.username.charAt(0).toUpperCase();

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 64px)' }}>
      {/* Animated Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.15, pointerEvents: 'none' }}>
        <Squares direction="diagonal" speed={0.4} squareSize={40} borderColor="var(--c-accent)" />
      </div>

      <div className="container profile-container" style={{ position: 'relative', zIndex: 1, maxWidth: '900px' }}>

        {/* ── Header / Avatar Section ──────────────────────────── */}
        <div className="profile-header">
          <div className="profile-avatar" aria-label="User avatar">
            <span className="profile-avatar-initial">{userInitial}</span>
            <div className="profile-avatar-ring" />
          </div>
          <h1 className="profile-name">
            <ShinyText text={user.username} speed={4} className="gradient-text" />
          </h1>
          <p className="profile-email">{user.email || 'No email set'}</p>
          <div className="profile-badge-row">
            <span className="badge badge-accent">🎮 Player</span>
          </div>
        </div>

        {/* ── Alerts ───────────────────────────────────────────── */}
        {success && (
          <div className="alert alert-success profile-alert" role="status">
            <span className="alert-icon">✓</span> {success}
          </div>
        )}
        {error && (
          <div className="alert alert-error profile-alert" role="alert">
            <span className="alert-icon">⚠️</span> {error}
          </div>
        )}

        {/* ── Two Column Layout ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* ── Profile Info Card ────────────────────────────────── */}
          <SpotlightCard className="profile-card" spotlightColor="rgba(124, 110, 245, 0.2)">
          <div className="profile-card-header">
            <h2 className="profile-card-title">
              {isEditing ? '✏️ Edit Profile' : '👤 Profile Details'}
            </h2>
            {!isEditing && (
              <button
                id="profile-edit-btn"
                onClick={handleEdit}
                className="btn btn-secondary btn-sm"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {!isEditing ? (
            /* ── View Mode ─────────────────────────────────────── */
            <div className="profile-fields">
              <div className="profile-field">
                <label className="profile-field-label">Username</label>
                <div className="profile-field-value">{user.username}</div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">Email</label>
                <div className="profile-field-value">{user.email || 'Not provided'}</div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">Role</label>
                <div className="profile-field-value" style={{ textTransform: 'capitalize' }}>
                  {user.role}
                </div>
              </div>
            </div>
          ) : (
            /* ── Edit Mode ─────────────────────────────────────── */
            <form onSubmit={handleSave} className="profile-form" noValidate>
              <div className="form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  className={`input${fieldErrors.username ? ' input-error' : ''}`}
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: undefined }));
                  }}
                  placeholder="your_username"
                  autoFocus
                  required
                  minLength={3}
                  maxLength={30}
                />
                {fieldErrors.username && (
                  <span className="field-error">{fieldErrors.username}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  className={`input${fieldErrors.email ? ' input-error' : ''}`}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                  placeholder="you@example.com"
                  required
                />
                {fieldErrors.email && (
                  <span className="field-error">{fieldErrors.email}</span>
                )}
              </div>

              <div className="profile-form-actions">
                <button
                  id="profile-save-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : '💾 Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </SpotlightCard>

        {/* ── Danger Zone / Logout ─────────────────────────────── */}
        <SpotlightCard className="profile-card profile-danger-zone" spotlightColor="rgba(245, 97, 124, 0.15)">
          <div className="profile-card-header">
            <h2 className="profile-card-title">⚙️ Session</h2>
          </div>
          <p className="profile-danger-text">
            End your current session. You will need to sign in again to access your account.
          </p>
          <button
            id="profile-logout-btn"
            onClick={handleLogout}
            className="btn btn-danger"
            disabled={loggingOut}
          >
            {loggingOut ? 'Signing out…' : '🚪 Sign Out'}
          </button>
        </SpotlightCard>

        </div> {/* End Two Column Layout */}

        {/* ── Back link ────────────────────────────────────────── */}
        <div className="profile-back">
          <Link to="/" className="btn btn-secondary btn-sm">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
