import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(),
}));
jest.mock("@/src/lib/config", () => ({ apiRoot: "https://noteschain.org/api/v1" }));

import { api, apiPage, setToken, setUnauthorizedHandler } from "./api";

const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockedGetRandomBytes = Crypto.getRandomBytesAsync as jest.Mock;

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
  setUnauthorizedHandler(undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockedGetItem.mockResolvedValue(null);
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ data: {} }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("api", () => {
  it("omits the Authorization header when there is no stored token", async () => {
    await api("/x");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).has("Authorization")).toBe(false);
  });

  it("sends a Bearer Authorization header when a token is stored", async () => {
    mockedGetItem.mockImplementation((key: string) => Promise.resolve(key.includes("session") ? "tok123" : null));
    await api("/x");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok123");
  });

  it("sets content-type only when a body is present", async () => {
    await api("/x");
    let [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).has("content-type")).toBe(false);

    await api("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    [, init] = (global.fetch as jest.Mock).mock.calls[1];
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("retries a failed safe read once before returning its response", async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(jsonResponse({ data: { recovered: true } }));

    await expect(api<{ recovered: boolean }>("/x")).resolves.toEqual({ recovered: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failed write", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));

    await expect(api("/x", { method: "POST", body: JSON.stringify({ value: true }) })).rejects.toMatchObject({
      status: 0,
      kind: "network",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes an Idempotency-Key header through when provided", async () => {
    await api("/x", { idempotencyKey: "abc" });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Headers).get("Idempotency-Key")).toBe("abc");
  });

  it("generates the visitor token once and reuses the persisted value on later calls", async () => {
    mockedGetRandomBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    await api("/x", { visitor: true });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);

    mockedGetItem.mockImplementation((key: string) => Promise.resolve(key.includes("visitor") ? "010203" : null));
    await api("/x", { visitor: true });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
    const [, secondInit] = (global.fetch as jest.Mock).mock.calls[1];
    expect((secondInit.headers as Headers).get("X-NotesChain-Visitor")).toBe("010203");
  });

  it("throws MobileApiError carrying the response status and server message", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ error: { message: "nope" } }, { ok: false, status: 422 }));
    await expect(api("/x")).rejects.toMatchObject({ status: 422, message: "nope" });
  });

  it("clears an expired stored session and notifies the navigator on a 401", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockedGetItem.mockResolvedValue("expired-token");
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ error: { message: "Sign in required." } }, { ok: false, status: 401 }));

    await expect(api("/bookmarks")).rejects.toMatchObject({ status: 401 });
    expect(mockedDeleteItem).toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("keeps the sign-in form in place for invalid mobile credentials", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ error: { message: "Invalid email or password." } }, { ok: false, status: 401 }));

    await expect(api("/auth/mobile/login", { method: "POST", body: JSON.stringify({}) })).rejects.toMatchObject({ status: 401 });
    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("uses a friendly fallback message for a 404 on a mobile auth endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));
    await expect(api("/auth/mobile/login")).rejects.toThrow(/Mobile sign-in is not available/);
  });

  it("apiPage falls back to an empty page when the server omits meta or data isn't an array", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ data: null }));
    const page = await apiPage("/x");
    expect(page).toEqual({ data: [], meta: { page: 1, pageSize: 0, total: 0 } });
  });
});

describe("setToken", () => {
  it("deletes the stored token when passed null", async () => {
    await setToken(null);
    expect(mockedDeleteItem).toHaveBeenCalled();
    expect(mockedSetItem).not.toHaveBeenCalled();
  });

  it("stores the token when passed a value", async () => {
    await setToken("abc");
    expect(mockedSetItem).toHaveBeenCalledWith(expect.stringContaining("session"), "abc");
  });
});
