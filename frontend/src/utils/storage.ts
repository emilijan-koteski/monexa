import { Language } from '../enums/Language.ts';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  LANGUAGE: 'language',
  DRAWER_STATE: 'drawerExpanded',
  REDIRECT_AFTER_LEGAL: 'redirectAfterLegal',
  RETURN_TO: 'returnTo',
} as const;

export const localStorageUtils = {
  getAccessToken: (): string | null => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  setAccessToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token),
  removeAccessToken: (): void => localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),

  getRefreshToken: (): string | null => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  setRefreshToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: (): void => localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),

  getLanguage: (): Language => (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language) || Language.EN,
  setLanguage: (lng: Language): void => localStorage.setItem(STORAGE_KEYS.LANGUAGE, lng),

  getDrawerState: (): string | null => localStorage.getItem(STORAGE_KEYS.DRAWER_STATE),
  setDrawerState: (state: string): void => localStorage.setItem(STORAGE_KEYS.DRAWER_STATE, state),
};

const CONTROL_CHARACTERS = /\p{Cc}/u;

export const isSafeReturnPath = (path: string | null): path is string =>
  path !== null &&
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/\\') &&
  !CONTROL_CHARACTERS.test(path);

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

  setReturnTo: (path: string): void => {
    sessionStorage.setItem(STORAGE_KEYS.RETURN_TO, path);
  },
  getReturnTo: (): string | null => {
    const path = sessionStorage.getItem(STORAGE_KEYS.RETURN_TO);
    return isSafeReturnPath(path) ? path : null;
  },
  clearReturnTo: (): void => {
    sessionStorage.removeItem(STORAGE_KEYS.RETURN_TO);
  },
};
