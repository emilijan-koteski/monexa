import { Language } from '../enums/Language.ts';

export const STORAGE_KEYS = {
  // Auth (localStorage)
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  // Preferences (localStorage)
  LANGUAGE: 'language',
  DRAWER_STATE: 'drawerExpanded',
  // Session (sessionStorage)
  REDIRECT_AFTER_LEGAL: 'redirectAfterLegal',
} as const;

export const localStorageUtils = {
  // Auth
  getAccessToken: (): string | null => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  setAccessToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token),
  removeAccessToken: (): void => localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),

  getRefreshToken: (): string | null => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  setRefreshToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: (): void => localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),

  // Preferences
  getLanguage: (): Language => (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language) || Language.EN,
  setLanguage: (lng: Language): void => localStorage.setItem(STORAGE_KEYS.LANGUAGE, lng),

  getDrawerState: (): string | null => localStorage.getItem(STORAGE_KEYS.DRAWER_STATE),
  setDrawerState: (state: string): void => localStorage.setItem(STORAGE_KEYS.DRAWER_STATE, state),
};

export const sessionStorageUtils = {
  setRedirectAfterLegal: (path: string): void => {
    sessionStorage.setItem(STORAGE_KEYS.REDIRECT_AFTER_LEGAL, path);
  },
  getRedirectAfterLegal: (): string | null => {
    return sessionStorage.getItem(STORAGE_KEYS.REDIRECT_AFTER_LEGAL);
  },
  clearRedirectAfterLegal: (): void => {
    sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_AFTER_LEGAL);
  },
};
