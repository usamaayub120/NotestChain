import NetInfo from "@react-native-community/netinfo";
import { syncQueuedMutations } from "./sync";
import { queued, removeQueued } from "./offline";
import { api } from "./api";

jest.mock("./offline", () => ({ queued: jest.fn(), removeQueued: jest.fn() }));
jest.mock("./api", () => ({ api: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { fetch: jest.fn() } }));

const mockedQueued = queued as jest.Mock;
const mockedRemoveQueued = removeQueued as jest.Mock;
const mockedApi = api as jest.Mock;
const mockedNetInfoFetch = NetInfo.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedNetInfoFetch.mockResolvedValue({ isConnected: true });
});

describe("syncQueuedMutations", () => {
  it("does nothing when offline", async () => {
    mockedNetInfoFetch.mockResolvedValue({ isConnected: false });
    mockedQueued.mockReturnValue([{ id: "a", method: "POST", path: "/x", body: {}, createdAt: 1 }]);
    await syncQueuedMutations();
    expect(mockedApi).not.toHaveBeenCalled();
    expect(mockedRemoveQueued).not.toHaveBeenCalled();
  });

  it("replays queued mutations in order, using each mutation's id as its idempotency key, and removes each on success", async () => {
    mockedQueued.mockReturnValue([
      { id: "a", method: "POST", path: "/a", body: { x: 1 }, createdAt: 1 },
      { id: "b", method: "POST", path: "/b", body: { x: 2 }, createdAt: 2 },
    ]);
    mockedApi.mockResolvedValue({});
    await syncQueuedMutations();
    expect(mockedApi).toHaveBeenNthCalledWith(1, "/a", expect.objectContaining({ method: "POST", idempotencyKey: "a" }));
    expect(mockedApi).toHaveBeenNthCalledWith(2, "/b", expect.objectContaining({ method: "POST", idempotencyKey: "b" }));
    expect(mockedRemoveQueued).toHaveBeenCalledWith("a");
    expect(mockedRemoveQueued).toHaveBeenCalledWith("b");
  });

  it("does not let one permanently-failing mutation block mutations queued after it", async () => {
    mockedQueued.mockReturnValue([
      { id: "a", method: "POST", path: "/a", body: {}, createdAt: 1 },
      { id: "b", method: "POST", path: "/b", body: {}, createdAt: 2 },
    ]);
    mockedApi.mockImplementation((path: string) => (path === "/a" ? Promise.reject(new Error("nope")) : Promise.resolve({})));
    await syncQueuedMutations();
    expect(mockedApi).toHaveBeenCalledWith("/b", expect.anything());
    expect(mockedRemoveQueued).toHaveBeenCalledWith("b");
    expect(mockedRemoveQueued).not.toHaveBeenCalledWith("a");
  });

  it("retries a dependent item once its dependency has already succeeded earlier in the same pass", async () => {
    mockedQueued.mockReturnValue([
      { id: "a", method: "POST", path: "/a", body: {}, createdAt: 1 },
      { id: "b", method: "POST", path: "/b", body: {}, createdAt: 2, dependencyId: "a" },
    ]);
    mockedApi.mockResolvedValue({});
    await syncQueuedMutations();
    expect(mockedApi).toHaveBeenCalledWith("/b", expect.anything());
    expect(mockedRemoveQueued).toHaveBeenCalledWith("b");
  });

  it("still skips a dependent item whose dependency has not run yet in this pass", async () => {
    // Dependency listed after its dependent — an ordering the queue itself
    // shouldn't produce, but the replay loop must not misbehave if it does.
    mockedQueued.mockReturnValue([
      { id: "b", method: "POST", path: "/b", body: {}, createdAt: 2, dependencyId: "a" },
      { id: "a", method: "POST", path: "/a", body: {}, createdAt: 1 },
    ]);
    mockedApi.mockResolvedValue({});
    await syncQueuedMutations();
    expect(mockedApi).not.toHaveBeenCalledWith("/b", expect.anything());
    expect(mockedRemoveQueued).not.toHaveBeenCalledWith("b");
  });

  it("does not run two replay passes concurrently", async () => {
    // The reentrancy guard is checked synchronously before the first await,
    // so calling twice back-to-back (no await between) exercises it directly
    // — the second call must see the flag already set by the first.
    mockedQueued.mockReturnValue([{ id: "a", method: "POST", path: "/a", body: {}, createdAt: 1 }]);
    mockedApi.mockResolvedValue({});
    const first = syncQueuedMutations();
    const second = syncQueuedMutations();
    await Promise.all([first, second]);
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });
});
