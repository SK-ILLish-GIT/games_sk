import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api/client';
import type { User, AuthCtx, UpdateUserRequest } from '../types';

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then(r => setUser(r.data.data as User))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const r = await authAPI.login(username, password);
    const { accessToken, refreshToken, user: u } = r.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(u);
  };

  const register = async (username: string, email: string, password: string) => {
    const r = await authAPI.register(username, email, password);
    const { accessToken, refreshToken } = r.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Fetch latest user profile (ensures email and other fields are populated)
    try {
      const me = await authAPI.me();
      setUser(me.data.data as User);
    } catch {
      // Fallback to any user object returned in the register response
      const u = (r.data.data as any).user as User | undefined;
      if (u) setUser(u);
    }
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { /* noop */ }
    localStorage.clear();
    setUser(null);
  };

  const updateProfile = async (data: UpdateUserRequest) => {
    const r = await authAPI.updateProfile(data);
    const updatedUser = r.data.data;
    setUser({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role as User['role'],
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
