import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchPaginated, ApiClientError } from "./api";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "nc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("apiFetch", () => {
  it("returns the data field on success", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { data: { id: "1" } }));
    const result = await apiFetch<{ id: string }>("/publications/1");
    expect(result).toEqual({ id: "1" });
  });

  it("throws ApiClientError with the server's code/message/details on failure", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(404, { error: { code: "NOT_FOUND", message: "Publication not found.", details: { id: "1" } } }),
    );

    await expect(apiFetch("/publications/1")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Publication not found.",
      details: { id: "1" },
    });
  });

  it("falls back to UNKNOWN/'Request failed.' when the error body is missing shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => undefined,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/anything")).rejects.toBeInstanceOf(ApiClientError);
    await expect(apiFetch("/anything")).rejects.toMatchObject({ status: 500, code: "UNKNOWN" });
  });

  it("echoes the nc_csrf cookie as x-csrf-token on non-GET requests, never on GET", async () => {
    document.cookie = "nc_csrf=abc123";
    const fetchMock = mockFetchOnce(200, { data: null });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/drafts", { method: "POST", body: { title: "x" } });
    const postHeaders = fetchMock.mock.calls[0]![1].headers;
    expect(postHeaders["x-csrf-token"]).toBe("abc123");

    await apiFetch("/drafts");
    const getHeaders = fetchMock.mock.calls[1]![1].headers;
    expect(getHeaders["x-csrf-token"]).toBeUndefined();
  });
});

describe("apiFetchPaginated", () => {
  it("returns both data and meta", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(200, { data: [{ id: "1" }], meta: { page: 1, pageSize: 20, total: 1 } }),
    );

    const result = await apiFetchPaginated<{ id: string }>("/admin/audit-log");
    expect(result.data).toEqual([{ id: "1" }]);
    expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });
});
