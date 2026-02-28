import { create } from 'zustand';


// ---------- i18n Store ----------
import { type Locale, getTranslations } from './i18n';

interface I18nState {
  locale: Locale;
  t: ReturnType<typeof getTranslations>;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => {
  const stored = (typeof window !== 'undefined' ? localStorage.getItem('locale') : null) as Locale | null;
  const locale: Locale = stored === 'en' ? 'en' : 'tr';
  return {
    locale,
    t: getTranslations(locale),
    setLocale: (locale: Locale) => {
      if (typeof window !== 'undefined') localStorage.setItem('locale', locale);
      set({ locale, t: getTranslations(locale) });
    },
  };
});

// ---------- Auth Store ----------
interface AuthState {
  user: { id: string; email: string; role: string } | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: any, token: string, refreshToken: string) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, refreshToken, isAuthenticated: true });
  },
  updateTokens: (token, refreshToken) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    set({ token, refreshToken });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },
}));
