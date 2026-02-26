import { create } from 'zustand';

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  token: string | null;
  setAuth: (user: any, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,
  setAuth: (user, token) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
