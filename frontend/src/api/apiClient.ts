import { ENV } from '../config/env';
import { tokenUtils } from '../utils/tokenUtils';

const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let failedRequestsQueue: Array<{
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  input: RequestInfo | URL;
  init?: RequestInit;
}> = [];

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/logout', '/auth/tokens/renew'];

const isAuthEndpoint = (url: string): boolean => {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = tokenUtils.getRefreshToken();

  if (!refreshToken || tokenUtils.isRefreshTokenExpired()) {
    return false;
  }

  try {
    const response = await fetch(`${ENV.API_BASE_URL}/auth/tokens/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    const { accessToken, accessTokenExpiresAt } = result.data;

    tokenUtils.setAccessToken(accessToken, accessTokenExpiresAt);
    return true;
  } catch {
    return false;
  }
};

const processQueue = (success: boolean): void => {
  failedRequestsQueue.forEach(({ resolve, reject, input, init }) => {
    if (success) {
      const newInit = addAuthHeader(init);
      fetch(input, newInit).then(resolve).catch(reject);
    } else {
      reject(new Error('Token refresh failed'));
    }
  });
  failedRequestsQueue = [];
};

const addAuthHeader = (init?: RequestInit): RequestInit => {
  const token = tokenUtils.getAccessToken();
  const existingHeaders = init?.headers instanceof Headers
    ? Object.fromEntries(init.headers.entries())
    : (init?.headers as Record<string, string>) || {};

  return {
    ...init,
    headers: {
      ...existingHeaders,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
};

const handleLogout = (): void => {
  tokenUtils.clearTokens();
  window.location.href = '/login';
};

export const apiClient = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (isAuthEndpoint(url)) {
    return fetch(input, init);
  }

  if (tokenUtils.isAccessTokenExpiringSoon(REFRESH_THRESHOLD_MS) && !isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();

    const success = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;
    processQueue(success);

    if (!success && tokenUtils.isAccessTokenExpired()) {
      handleLogout();
    }
  }

  if (isRefreshing && refreshPromise) {
    return new Promise((resolve, reject) => {
      failedRequestsQueue.push({ resolve, reject, input, init });
    });
  }

  const response = await fetch(input, init);

  if (response.status === 401) {
    if (isRefreshing && refreshPromise) {
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({ resolve, reject, input, init });
      });
    }

    isRefreshing = true;
    refreshPromise = refreshAccessToken();

    const success = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;
    processQueue(success);

    if (success) {
      const newInit = addAuthHeader(init);
      return fetch(input, newInit);
    } else {
      handleLogout();
    }
  }

  return response;
};

export const createAuthHeaders = (): HeadersInit => {
  const token = tokenUtils.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};
