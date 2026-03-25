import type { User } from '../types/models';
import { localStorageUtils } from './storage';

export const tokenUtils = {
  setTokens: (
    accessToken: string,
    accessTokenExpiresAt: string,
    refreshToken: string,
    refreshTokenExpiresAt: string
  ): void => {
    localStorageUtils.setAccessToken(accessToken);
    localStorageUtils.setAccessTokenExpiresAt(accessTokenExpiresAt);
    localStorageUtils.setRefreshToken(refreshToken);
    localStorageUtils.setRefreshTokenExpiresAt(refreshTokenExpiresAt);
  },

  setAccessToken: (accessToken: string, accessTokenExpiresAt: string): void => {
    localStorageUtils.setAccessToken(accessToken);
    localStorageUtils.setAccessTokenExpiresAt(accessTokenExpiresAt);
  },

  getAccessToken: (): string | null => {
    return localStorageUtils.getAccessToken();
  },

  getRefreshToken: (): string | null => {
    return localStorageUtils.getRefreshToken();
  },

  getAccessTokenExpiry: (): Date | null => {
    const expiresAt = localStorageUtils.getAccessTokenExpiresAt();
    return expiresAt ? new Date(expiresAt) : null;
  },

  getRefreshTokenExpiry: (): Date | null => {
    const expiresAt = localStorageUtils.getRefreshTokenExpiresAt();
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
    localStorageUtils.removeAccessToken();
    localStorageUtils.removeAccessTokenExpiresAt();
    localStorageUtils.removeRefreshToken();
    localStorageUtils.removeRefreshTokenExpiresAt();
    localStorageUtils.removeUser();
    window.dispatchEvent(new Event('user-updated'));
  },

  setUser: (user: User): void => {
    localStorageUtils.setUser(JSON.stringify(user));
    window.dispatchEvent(new Event('user-updated'));
  },

  getUser: (): User | null => {
    const userString = localStorageUtils.getUser();
    return userString ? JSON.parse(userString) : null;
  },

  isAuthenticated: (): boolean => {
    const hasAccessToken = !!tokenUtils.getAccessToken();
    const hasRefreshToken = !!tokenUtils.getRefreshToken();
    const refreshNotExpired = !tokenUtils.isRefreshTokenExpired();
    return hasAccessToken && hasRefreshToken && refreshNotExpired;
  },
};
