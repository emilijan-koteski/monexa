import { USER_AGENT } from "../version.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const NO_RESPONSE_STATUS = 0;

const MESSAGES = {
  legalAcceptanceRequired:
    "Monexa needs you to accept updated terms. Open https://monexa.world, sign in and accept them, then try again.",
  unauthorized: "Your Monexa connection expired; reconnect the app.",
  forbidden: "This connection doesn't have permission for that (it may be read-only).",
  notFound: "Not found.",
  timeout: "Monexa did not respond in time; try again.",
  cancelled: "The request was cancelled.",
  unreachable: "Monexa is unreachable right now; try again shortly.",
  unexpectedResponse: "Monexa returned an unexpected response.",
} as const;

export type QueryValue = string | number | boolean | readonly (string | number)[] | undefined;

export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ApiClient {
  get<T>(path: string, query?: Query, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
}

export interface ApiClientOptions {
  baseUrl: string;
  token: string;
  onUnauthorized?: () => void;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** A failed REST call; `message` is safe to show to the user and `status` is 0 when no response arrived. */
export class ApiError extends Error {
  override name = "ApiError";

  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

/** Creates a client for the Monexa REST API that authenticates with a delegated JWT and unwraps the response envelope. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));

  async function send<T>(request: ApiRequest): Promise<T> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.token}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    };
    if (request.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    let response: Response;
    let text: string;
    try {
      response = await fetchImpl(buildUrl(options.baseUrl, request.path, request.query), {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout,
      });
      text = await response.text();
    } catch (error) {
      throw transportError(error, timeout);
    }
    if (!response.ok) {
      throw httpError(response.status, parseJson(text), options.onUnauthorized);
    }
    return unwrapData<T>(response.status, text);
  }

  return {
    get: (path, query, requestOptions) => send({ method: "GET", path, query, ...requestOptions }),
    post: (path, body, requestOptions) => send({ method: "POST", path, body, ...requestOptions }),
    patch: (path, body, requestOptions) => send({ method: "PATCH", path, body, ...requestOptions }),
    delete: (path, requestOptions) => send({ method: "DELETE", path, ...requestOptions }),
  };
}

/** Encodes arrays as repeated parameters (`ids=1&ids=2`), which is how Echo binds slice query fields. */
function buildUrl(baseUrl: string, path: string, query: Query | undefined): string {
  const url = new URL(baseUrl + path);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(name, String(item));
    }
  }
  return url.href;
}

function unwrapData<T>(status: number, text: string): T {
  if (text.trim() === "") {
    return undefined as T;
  }
  const body = parseJson(text);
  if (typeof body !== "object" || body === null) {
    throw new ApiError(status, MESSAGES.unexpectedResponse);
  }
  return (body as { data?: T }).data as T;
}

function httpError(status: number, body: unknown, onUnauthorized: (() => void) | undefined): ApiError {
  switch (status) {
    case 451:
      return new ApiError(status, MESSAGES.legalAcceptanceRequired);
    case 401:
      onUnauthorized?.();
      return new ApiError(status, MESSAGES.unauthorized);
    case 403:
      return new ApiError(status, MESSAGES.forbidden);
    case 404:
      return new ApiError(status, MESSAGES.notFound);
    default:
      return new ApiError(status, errorText(body) ?? `Monexa API request failed with status ${status}.`);
  }
}

function errorText(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { message, error } = body as Record<string, unknown>;
  const text = [message, error].find((value) => typeof value === "string" && value.trim() !== "");
  return text as string | undefined;
}

function transportError(error: unknown, timeout: AbortSignal): ApiError {
  if (timeout.aborted) {
    return new ApiError(NO_RESPONSE_STATUS, MESSAGES.timeout);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ApiError(NO_RESPONSE_STATUS, MESSAGES.cancelled);
  }
  return new ApiError(NO_RESPONSE_STATUS, MESSAGES.unreachable);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
