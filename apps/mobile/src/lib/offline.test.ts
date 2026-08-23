type Row = { id: string; method: string; path: string; body: string; dependencyId?: string | null; createdAt: number };
type Recovery = { id: string; draftId: string; body: string; createdAt: number };

function makeFakeDb() {
  const cache = new Map<string, string>();
  const mutations = new Map<string, Row>();
  let recoveries: Recovery[] = [];

  const db = {
    cache,
    mutations,
    get recoveries() { return recoveries; },
    execSync: jest.fn(),
    runSync: jest.fn((sql: string, ...params: unknown[]) => {
      if (sql.includes("INSERT OR REPLACE INTO cache")) {
        cache.set(params[0] as string, params[1] as string);
      } else if (sql.includes("INSERT OR REPLACE INTO mutations")) {
        const [id, method, path, body, dependencyId, createdAt] = params as [string, string, string, string, string | null, number];
        mutations.set(id, { id, method, path, body, dependencyId: dependencyId ?? undefined, createdAt });
      } else if (sql.includes("DELETE FROM mutations")) {
        mutations.delete(params[0] as string);
      } else if (sql.includes("INSERT INTO recoveries")) {
        const [id, draftId, body, createdAt] = params as [string, string, string, number];
        recoveries.push({ id, draftId, body, createdAt });
      } else if (sql.includes("NOT IN")) {
        const draftId = params[0] as string;
        const forDraft = recoveries.filter((r) => r.draftId === draftId).sort((a, b) => b.createdAt - a.createdAt);
        const keep = new Set(forDraft.slice(0, 3).map((r) => r.id));
        recoveries = recoveries.filter((r) => r.draftId !== draftId || keep.has(r.id));
      } else if (sql.includes("DELETE FROM recoveries")) {
        const draftId = params[0] as string;
        recoveries = recoveries.filter((r) => r.draftId !== draftId);
      }
    }),
    getFirstSync: jest.fn((sql: string, ...params: unknown[]) => {
      if (sql.includes("SELECT value FROM cache")) {
        const value = cache.get(params[0] as string);
        return value === undefined ? undefined : { value };
      }
      return undefined;
    }),
    getAllSync: jest.fn((sql: string, ...params: unknown[]) => {
      if (sql.includes("SELECT * FROM mutations")) {
        return Array.from(mutations.values()).sort((a, b) => a.createdAt - b.createdAt);
      }
      if (sql.includes("SELECT * FROM recoveries")) {
        const draftId = params[0] as string;
        return recoveries.filter((r) => r.draftId === draftId).sort((a, b) => b.createdAt - a.createdAt);
      }
      return [];
    }),
  };
  return db;
}

describe("offline store", () => {
  let fakeDb: ReturnType<typeof makeFakeDb>;

  beforeEach(() => {
    jest.resetModules();
    fakeDb = makeFakeDb();
    jest.doMock("expo-sqlite", () => ({ openDatabaseSync: jest.fn(() => fakeDb) }));
  });

  // Dynamic require, deliberately: jest.resetModules() above only takes
  // effect on the next require, so this must stay a require, not a static
  // top-of-file import, to pick up a fresh module (and fresh fake db) per test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const load = () => require("./offline") as typeof import("./offline");

  it("initialises the schema once and returns true", () => {
    const offline = load();
    expect(offline.initialiseOfflineStore()).toBe(true);
    expect(offline.initialiseOfflineStore()).toBe(true);
    expect(fakeDb.execSync).toHaveBeenCalledTimes(1);
  });

  it("returns false, without throwing, when schema creation fails", () => {
    fakeDb.execSync.mockImplementation(() => { throw new Error("sqlite unavailable"); });
    const offline = load();
    expect(offline.initialiseOfflineStore()).toBe(false);
    expect(() => offline.cacheRead("x")).not.toThrow();
    expect(offline.cacheRead("x")).toBeNull();
    expect(() => offline.cacheWrite("x", 1)).not.toThrow();
  });

  it("round-trips cacheWrite/cacheRead, and returns null for a missing or corrupt entry", () => {
    const offline = load();
    offline.cacheWrite("k", { a: 1 });
    expect(offline.cacheRead<{ a: number }>("k")).toEqual({ a: 1 });
    expect(offline.cacheRead("missing")).toBeNull();
    fakeDb.cache.set("corrupt", "{not json");
    expect(offline.cacheRead("corrupt")).toBeNull();
  });

  it("enqueue upserts by id, and queued() orders by createdAt ascending", () => {
    const offline = load();
    offline.enqueue({ id: "a", method: "POST", path: "/a", body: {}, createdAt: 2 });
    offline.enqueue({ id: "b", method: "POST", path: "/b", body: {}, createdAt: 1 });
    offline.enqueue({ id: "a", method: "PATCH", path: "/a2", body: {}, createdAt: 2 });
    const rows = offline.queued();
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows.find((r) => r.id === "a")?.method).toBe("PATCH");
  });

  it("removeQueued removes only the given mutation", () => {
    const offline = load();
    offline.enqueue({ id: "a", method: "POST", path: "/a", body: {}, createdAt: 1 });
    offline.enqueue({ id: "b", method: "POST", path: "/b", body: {}, createdAt: 2 });
    offline.removeQueued("a");
    expect(offline.queued().map((r) => r.id)).toEqual(["b"]);
  });

  it("preserveRecovery retains only the newest 3 snapshots per draft", () => {
    const offline = load();
    const nowSpy = jest.spyOn(Date, "now");
    for (let i = 1; i <= 4; i++) {
      nowSpy.mockReturnValue(1000 + i);
      offline.preserveRecovery("draft-1", { title: `v${i}` });
    }
    nowSpy.mockRestore();
    const rows = offline.recoveriesFor("draft-1");
    expect(rows).toHaveLength(3);
    expect((rows[0].body as { title: string }).title).toBe("v4");
    expect(rows.map((r) => (r.body as { title: string }).title)).not.toContain("v1");
  });

  it("clearRecoveries only affects the given draft", () => {
    const offline = load();
    offline.preserveRecovery("draft-1", { title: "a" });
    offline.preserveRecovery("draft-2", { title: "b" });
    offline.clearRecoveries("draft-1");
    expect(offline.recoveriesFor("draft-1")).toHaveLength(0);
    expect(offline.recoveriesFor("draft-2")).toHaveLength(1);
  });
});
