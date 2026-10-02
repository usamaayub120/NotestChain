import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { Page } from "@/src/lib/models";
import { apiRoot } from "@/src/lib/config";
import { getAppCheckToken } from "@/src/lib/app-check";

const API_ROOT = apiRoot;
const TOKEN_KEY = "noteschain.mobile.session";
const VISITOR_KEY = "noteschain.mobile.visitor";
const REQUEST_TIMEOUT_MS = 10_000;
const READ_RETRY_DELAY_MS = 400;

let unauthorizedHandler: ((returnNote?: string) => void) | undefined;

export class MobileApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public kind: "http" | "network" | "timeout" | "cancelled" = "http",
  ) { super(message); }
}

export async function getToken() { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * The navigator registers this once so an expired mobile bearer session
 * consistently returns the person to Account, regardless of which protected
 * screen made the request. Returning a cleanup function keeps test/runtime
 * remounts from retaining a stale callback.
 */
export function setUnauthorizedHandler(handler: ((returnNote?: string) => void) | undefined) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
  };
}

async function visitorToken() {
  let token = await SecureStore.getItemAsync(VISITOR_KEY);
  if (!token) {
    token = Array.from(await Crypto.getRandomBytesAsync(32), (part) => part.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(VISITOR_KEY, token);
  }
  return token;
}

export type MobileRequestInit = RequestInit & {
  /** Return to this note after re-authentication; never an arbitrary URL. */
  returnNote?: string;
  idempotencyKey?: string;
  visitor?: boolean;
  /** Override the normal API timeout for a request with a stricter deadline. */
  timeoutMs?: number;
  /** Safe reads retry once by default; startup policy checks intentionally do not. */
  retry?: boolean;
  /** Only consented installation endpoints request an App Check assertion. */
  appCheck?: boolean;
};
type ApiEnvelope<T> = { data: T; meta?: Page<never>["meta"] };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isSafeRead = (method: string | undefined) => !method || method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";

function logRequestFailure(path: string, method: string | undefined, durationMs: number, error: MobileApiError, attempt: number) {
  // This is intentionally metadata only: paths, timings, and error categories
  // help diagnose a device-network problem without logging tokens or response bodies.
  console.warn("[NotesChain API] request failed", {
    method: method ?? "GET",
    path,
    durationMs: Math.round(durationMs),
    status: error.status,
    kind: error.kind,
    attempt,
  });
}

async function request<T>(path: string, init: MobileRequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
  if (init.visitor) headers.set("X-NotesChain-Visitor", await visitorToken());
  if (init.appCheck) headers.set("X-Firebase-AppCheck", await getAppCheckToken());

  const attempts = isSafeRead(init.method) && init.retry !== false ? 2 : 1;
  let lastError: MobileApiError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    init.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, init.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      // Keep the timer alive until the body is decoded too: a connection can
      // otherwise appear healthy after headers but still stall while reading.
      const response = await fetch(`${API_ROOT}${path}`, { ...init, headers, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // A mobile bearer token is invalid or expired. Remove it before the
        // screen handles the error, then let the root navigator show sign-in.
        // Do not redirect for a bad sign-in attempt: there is no existing
        // session to clear and the form needs to display that server message.
        if (response.status === 401 && token && !path.startsWith("/auth/mobile/login")) {
          await setToken(null);
          unauthorizedHandler?.(init.returnNote);
        }
        const message = response.status === 404 && path.startsWith("/auth/mobile/")
          ? "Mobile sign-in is not available on the server yet. Please try again after the NotesChain update finishes."
          : payload?.error?.message ?? "Request failed.";
        throw new MobileApiError(response.status, message);
      }
      return payload as ApiEnvelope<T>;
    } catch (error) {
      const mobileError = error instanceof MobileApiError
        ? error
        : new MobileApiError(
          0,
          timedOut
            ? "The connection timed out. Check your internet connection and try again."
            : controller.signal.aborted
              ? "Request cancelled."
              : "Couldn't reach NotesChain. Check your connection and try again.",
          timedOut ? "timeout" : controller.signal.aborted ? "cancelled" : "network",
        );
      logRequestFailure(path, init.method, Date.now() - startedAt, mobileError, attempt);
      lastError = mobileError;

      const canRetry = attempt < attempts && (mobileError.kind === "network" || mobileError.kind === "timeout" || mobileError.status >= 500);
      if (!canRetry) throw mobileError;
      await pause(READ_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
  throw lastError ?? new MobileApiError(0, "Couldn't reach NotesChain. Check your connection and try again.", "network");
}

export async function api<T>(path: string, init: MobileRequestInit = {}): Promise<T> {
  return (await request<T>(path, init)).data;
}

/** List endpoints keep their pagination envelope; most API calls return only data. */
export async function apiPage<T>(path: string, init: MobileRequestInit = {}): Promise<Page<T>> {
  const payload = await request<T[]>(path, init);
  return { data: Array.isArray(payload.data) ? payload.data : [], meta: payload.meta ?? { page: 1, pageSize: 0, total: 0 } };
}
