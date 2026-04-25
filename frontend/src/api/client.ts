import axios from 'axios';

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
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          err.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(err.config);
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
    api.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Leaderboard
export const leaderboardAPI = {
  getGlobal: (limit = 50) => api.get(`/leaderboard/leaderboard/global?limit=${limit}`),
  getByGame: (gameId: string, limit = 50) => api.get(`/leaderboard/leaderboard/${gameId}?limit=${limit}`),
  getMyRank: (gameId: string) => api.get(`/leaderboard/leaderboard/${gameId}/me`),
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

export default api;
