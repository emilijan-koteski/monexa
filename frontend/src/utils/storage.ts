import { Language } from '../enums/Language.ts';

export const STORAGE_KEYS = {
  // Auth (localStorage)
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_EXPIRES_AT: 'accessTokenExpiresAt',
  REFRESH_TOKEN: 'refreshToken',
  REFRESH_TOKEN_EXPIRES_AT: 'refreshTokenExpiresAt',
  USER: 'user',
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

  getAccessTokenExpiresAt: (): string | null => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT),
  setAccessTokenExpiresAt: (expiresAt: string): void => localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT, expiresAt),
  removeAccessTokenExpiresAt: (): void => localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT),

  getRefreshToken: (): string | null => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  setRefreshToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: (): void => localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),

  getRefreshTokenExpiresAt: (): string | null => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT),
  setRefreshTokenExpiresAt: (expiresAt: string): void => localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT, expiresAt),
  removeRefreshTokenExpiresAt: (): void => localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT),

  getUser: (): string | null => localStorage.getItem(STORAGE_KEYS.USER),
  setUser: (user: string): void => localStorage.setItem(STORAGE_KEYS.USER, user),
  removeUser: (): void => localStorage.removeItem(STORAGE_KEYS.USER),

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
