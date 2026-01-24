import type { User } from '../types/models';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  ACCESS_TOKEN_EXPIRES_AT: 'accessTokenExpiresAt',
  REFRESH_TOKEN: 'refreshToken',
  REFRESH_TOKEN_EXPIRES_AT: 'refreshTokenExpiresAt',
  USER: 'user',
};

export const tokenUtils = {
  /**
   * Store all tokens with their expiry times
   */
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

  /**
   * Update only the access token (used after refresh)
   */
  setAccessToken: (accessToken: string, accessTokenExpiresAt: string): void => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT, accessTokenExpiresAt);
  },

  /**
   * Get the access token
   */
  getAccessToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  /**
   * Get the refresh token
   */
  getRefreshToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  /**
   * Get access token expiry as Date
   */
  getAccessTokenExpiry: (): Date | null => {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT);
    return expiresAt ? new Date(expiresAt) : null;
  },

  /**
   * Get refresh token expiry as Date
   */
  getRefreshTokenExpiry: (): Date | null => {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT);
    return expiresAt ? new Date(expiresAt) : null;
  },

  /**
   * Check if access token is about to expire within the given threshold
   * @param thresholdMs - Threshold in milliseconds (default: 1 day)
   */
  isAccessTokenExpiringSoon: (thresholdMs: number = 24 * 60 * 60 * 1000): boolean => {
    const expiresAt = tokenUtils.getAccessTokenExpiry();
    if (!expiresAt) return true;

    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    return timeUntilExpiry < thresholdMs;
  },

  /**
   * Check if access token has expired
   */
  isAccessTokenExpired: (): boolean => {
    const expiresAt = tokenUtils.getAccessTokenExpiry();
    if (!expiresAt) return true;
    return new Date() >= expiresAt;
  },

  /**
   * Check if refresh token has expired
   */
  isRefreshTokenExpired: (): boolean => {
    const expiresAt = tokenUtils.getRefreshTokenExpiry();
    if (!expiresAt) return true;
    return new Date() >= expiresAt;
  },

  /**
   * Clear all auth-related data from storage
   */
  clearTokens: (): void => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  /**
   * Store user data
   */
  setUser: (user: User): void => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  /**
   * Get stored user data
   */
  getUser: (): User | null => {
    const userString = localStorage.getItem(STORAGE_KEYS.USER);
    return userString ? JSON.parse(userString) : null;
  },

  /**
   * Check if user is authenticated (has valid tokens)
   */
  isAuthenticated: (): boolean => {
    const hasAccessToken = !!tokenUtils.getAccessToken();
    const hasRefreshToken = !!tokenUtils.getRefreshToken();
    const refreshNotExpired = !tokenUtils.isRefreshTokenExpired();
    return hasAccessToken && hasRefreshToken && refreshNotExpired;
  },
};
