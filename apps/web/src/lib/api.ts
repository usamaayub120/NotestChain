const CSRF_COOKIE_NAME = "nc_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * The request never reached the API. Distinct from ApiClientError, which means
 * the server answered and said no.
 *
 * `fetch` rejects with a bare TypeError for a dropped connection, a DNS
 * failure, and a blocked request alike, and every call site used to collapse
 * that into "Something went wrong." Losing your connection is the most common
 * failure this app has and the only one the reader can actually act on, so it
 * gets its own type and its own sentence.
 */
export class ApiNetworkError extends Error {
  constructor(public readonly offline: boolean) {
    super(offline ? "You're offline." : "We couldn't reach NotesChain.");
  }
}

/**
 * The one place that turns a thrown value into something a person can read.
 * `fallback` names what failed, in the caller's own words.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiNetworkError) return error.message;
  if (error instanceof ApiClientError) return error.message;
  return fallback;
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

async function request(path: string, options: RequestOptions): Promise<{ data: unknown; meta?: PaginationMeta }> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers[CSRF_HEADER_NAME] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "include",
      signal: options.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // An aborted request is the caller's own doing, not a failure to report.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiNetworkError(!navigator.onLine);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const err = payload?.error;
    throw new ApiClientError(response.status, err?.code ?? "UNKNOWN", err?.message ?? "Request failed.", err?.details);
  }

  return payload ?? { data: undefined };
}

/**
 * Always relative to /api/v1 -  never a hardcoded environment-specific
 * domain. Nginx proxies this to the API in every environment.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request(path, options);
  return payload.data as T;
}

/** Same as apiFetch, but for endpoints using the `paginated()` response shape -  keeps `meta` too. */
export async function apiFetchPaginated<T>(path: string, options: RequestOptions = {}): Promise<PaginatedResult<T>> {
  const payload = await request(path, options);
  return { data: payload.data as T[], meta: payload.meta! };
}
