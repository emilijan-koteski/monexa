import { getValidAccessToken, forceRefresh } from "./auth.js";

const BASE_URL =
  process.env.MONEXA_API_BASE_URL ?? "https://api.monexa.world/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, string | number | boolean | string[] | number[] | undefined>;
    authenticated?: boolean;
  }
): Promise<T> {
  const authenticated = options?.authenticated ?? true;

  const url = new URL(`${BASE_URL}${path}`);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authenticated) {
    const token = await getValidAccessToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let response = await fetch(url.toString(), init);

  // Retry once on 401 with refreshed token
  if (response.status === 401 && authenticated) {
    const refreshed = await forceRefresh();
    if (refreshed) {
      const newToken = await getValidAccessToken();
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url.toString(), { method, headers, body: init.body });
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.message ?? body.error ?? `API error ${response.status}`;
    throw new ApiError(response.status, message);
  }

  const result = await response.json();
  return result.data as T;
}
