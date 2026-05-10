import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody, AuthTokenResponse, RefreshTokenResponse } from '../types';

const api = axios.create({ baseURL: '/api' });

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const originalRequest = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post<{ data: RefreshTokenResponse }>('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post<{ data: AuthTokenResponse }>('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    api.post<{ data: AuthTokenResponse }>('/auth/login', { username, password }),
  me: () => api.get<{ data: { id: string; username: string; email: string; role: string } }>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data: { username?: string; email?: string }) =>
    api.put<{ data: { id: string; username: string; email: string; role: string } }>('/auth/me', data),
};

// Leaderboard
export const leaderboardAPI = {
  getGlobal: (limit = 50) => api.get(`/leaderboard/global?limit=${limit}`),
  getByGame: (gameId: string, limit = 50) => api.get(`/leaderboard/${gameId}?limit=${limit}`),
  getMyRank: (gameId: string) => api.get(`/leaderboard/${gameId}/me`),
};

// Tic-Tac-Toe
export const ticTacToeAPI = {
  create: () => api.post('/tic-tac-toe/games'),
  get: (id: string) => api.get(`/tic-tac-toe/games/${id}`),
  move: (id: string, position: number) => api.post(`/tic-tac-toe/games/${id}/move`, { position }),
};

// Guess Number
export const guessAPI = {
  create: () => api.post('/guess-number/games'),
  get: (id: string) => api.get(`/guess-number/games/${id}`),
  guess: (id: string, guess: number) => api.post(`/guess-number/games/${id}/guess`, { guess }),
};

// Hangman
export const hangmanAPI = {
  create: (difficulty?: 'easy' | 'medium' | 'hard') => api.post('/hangman/games', difficulty ? { difficulty } : {}),
  get: (id: string) => api.get(`/hangman/games/${id}`),
  guessLetter: (id: string, letter: string) => api.post(`/hangman/games/${id}/guess`, { letter }),
  guessWord:   (id: string, word: string)   => api.post(`/hangman/games/${id}/guess`, { word }),
};

// Helper to extract error message safely from Axios errors (replaces `err: any` catch patterns)
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return body?.error ?? body?.message ?? fallback;
  }
  return fallback;
}

export default api;
