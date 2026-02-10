import type { User } from '../types/models';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_EXPIRES_AT: 'accessTokenExpiresAt',
  REFRESH_TOKEN: 'refreshToken',
  REFRESH_TOKEN_EXPIRES_AT: 'refreshTokenExpiresAt',
  USER: 'user',
};

export const tokenUtils = {
  setTokens: (
    accessToken: string,
    accessTokenExpiresAt: string,
    refreshToken: string,
    refreshTokenExpiresAt: string
  ): void => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT, accessTokenExpiresAt);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT, refreshTokenExpiresAt);
  },

  setAccessToken: (accessToken: string, accessTokenExpiresAt: string): void => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT, accessTokenExpiresAt);
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  getAccessTokenExpiry: (): Date | null => {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT);
    return expiresAt ? new Date(expiresAt) : null;
  },

  getRefreshTokenExpiry: (): Date | null => {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT);
    return expiresAt ? new Date(expiresAt) : null;
  },

  isAccessTokenExpiringSoon: (thresholdMs: number = 24 * 60 * 60 * 1000): boolean => {
    const expiresAt = tokenUtils.getAccessTokenExpiry();
    if (!expiresAt) return true;

    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    return timeUntilExpiry < thresholdMs;
  },

  isAccessTokenExpired: (): boolean => {
    const expiresAt = tokenUtils.getAccessTokenExpiry();
    if (!expiresAt) return true;
    return new Date() >= expiresAt;
  },

  isRefreshTokenExpired: (): boolean => {
    const expiresAt = tokenUtils.getRefreshTokenExpiry();
    if (!expiresAt) return true;
    return new Date() >= expiresAt;
  },

  clearTokens: (): void => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  setUser: (user: User): void => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    window.dispatchEvent(new Event('user-updated'));
  },

  getUser: (): User | null => {
    const userString = localStorage.getItem(STORAGE_KEYS.USER);
    return userString ? JSON.parse(userString) : null;
  },

  isAuthenticated: (): boolean => {
    const hasAccessToken = !!tokenUtils.getAccessToken();
    const hasRefreshToken = !!tokenUtils.getRefreshToken();
    const refreshNotExpired = !tokenUtils.isRefreshTokenExpired();
    return hasAccessToken && hasRefreshToken && refreshNotExpired;
  },
};
