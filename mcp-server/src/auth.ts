import type { User, LoginResponse, RenewTokenResponse } from "./types.js";

const BASE_URL =
  process.env.MONEXA_API_BASE_URL ?? "https://api.monexa.world/api/v1";
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TokenState {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: User;
}

let tokenState: TokenState | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function isAuthenticated(): boolean {
  return tokenState !== null;
}

export function getCachedUser(): User | null {
  return tokenState?.user ?? null;
}

export function updateCachedUser(user: User): void {
  if (tokenState) {
    tokenState.user = user;
  }
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message ?? body.error ?? `Login failed with status ${response.status}`
    );
  }

  const result = await response.json();
  const data: LoginResponse = result.data;

  tokenState = {
    accessToken: data.accessToken,
    accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
    refreshToken: data.refreshToken,
    refreshTokenExpiresAt: new Date(data.refreshTokenExpiresAt),
    user: data.user,
  };

  return data;
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message ?? body.error ?? `Registration failed with status ${response.status}`
    );
  }

  const result = await response.json();
  const data: LoginResponse = result.data;

  tokenState = {
    accessToken: data.accessToken,
    accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
    refreshToken: data.refreshToken,
    refreshTokenExpiresAt: new Date(data.refreshTokenExpiresAt),
    user: data.user,
  };

  return data;
}

async function renewAccessToken(): Promise<boolean> {
  if (!tokenState) return false;

  if (new Date() >= tokenState.refreshTokenExpiresAt) {
    return false;
  }

  try {
    const response = await fetch(`${BASE_URL}/auth/tokens/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenState.refreshToken }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    const data: RenewTokenResponse = result.data;

    tokenState.accessToken = data.accessToken;
    tokenState.accessTokenExpiresAt = new Date(data.accessTokenExpiresAt);
    return true;
  } catch {
    return false;
  }
}

export async function getValidAccessToken(): Promise<string> {
  if (!tokenState) {
    throw new Error("Not authenticated. Call the login or register tool first.");
  }

  if (new Date() >= tokenState.refreshTokenExpiresAt) {
    throw new Error(
      "Session expired (refresh token). Please call the login tool again."
    );
  }

  const now = new Date();
  const expiresIn =
    tokenState.accessTokenExpiresAt.getTime() - now.getTime();

  if (expiresIn < REFRESH_THRESHOLD_MS) {
    if (refreshPromise) {
      await refreshPromise;
    } else {
      refreshPromise = renewAccessToken();
      const success = await refreshPromise;
      refreshPromise = null;

      if (!success && now >= tokenState.accessTokenExpiresAt) {
        throw new Error(
          "Token refresh failed and access token is expired. Call the login tool again."
        );
      }
    }
  }

  return tokenState.accessToken;
}

export async function forceRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = renewAccessToken();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}
