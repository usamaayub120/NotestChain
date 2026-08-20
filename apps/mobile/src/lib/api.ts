import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const API_ROOT = "https://noteschain.org/api/v1";
const TOKEN_KEY = "noteschain.mobile.session";
const VISITOR_KEY = "noteschain.mobile.visitor";

export class MobileApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function getToken() { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function visitorToken() {
  let token = await SecureStore.getItemAsync(VISITOR_KEY);
  if (!token) {
    token = Array.from(await Crypto.getRandomBytesAsync(32), (part) => part.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(VISITOR_KEY, token);
  }
  return token;
}

export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string; visitor?: boolean } = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
  if (init.visitor) headers.set("X-NotesChain-Visitor", await visitorToken());
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 404 && path.startsWith("/auth/mobile/")
      ? "Mobile sign-in is not available on the server yet. Please try again after the NotesChain update finishes."
      : payload?.error?.message ?? "Request failed.";
    throw new MobileApiError(response.status, message);
  }
  return payload.data as T;
}
