import { localStorageUtils } from './storage';

export const tokenUtils = {
  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorageUtils.setAccessToken(accessToken);
    localStorageUtils.setRefreshToken(refreshToken);
  },

  setAccessToken: (accessToken: string): void => {
    localStorageUtils.setAccessToken(accessToken);
  },

  setRefreshToken: (refreshToken: string): void => {
    localStorageUtils.setRefreshToken(refreshToken);
  },

  getAccessToken: (): string | null => {
    return localStorageUtils.getAccessToken();
  },

  getRefreshToken: (): string | null => {
    return localStorageUtils.getRefreshToken();
  },

  getAccessTokenExpiry: (): Date | null => {
    const token = localStorageUtils.getAccessToken();
    if (!token) return null;
    return tokenUtils.getTokenExpiry(token);
  },

  getRefreshTokenExpiry: (): Date | null => {
    const token = localStorageUtils.getRefreshToken();
    if (!token) return null;
    return tokenUtils.getTokenExpiry(token);
  },

  getTokenExpiry: (token: string): Date | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(payload);

      if (typeof claims.exp !== 'number') return null;
      return new Date(claims.exp * 1000);
    } catch {
      return null;
    }
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
    localStorageUtils.removeAccessToken();
    localStorageUtils.removeRefreshToken();
  },

  isAuthenticated: (): boolean => {
    const hasAccessToken = !!tokenUtils.getAccessToken();
    const hasRefreshToken = !!tokenUtils.getRefreshToken();
    const refreshNotExpired = !tokenUtils.isRefreshTokenExpired();
    return hasAccessToken && hasRefreshToken && refreshNotExpired;
  },
};
