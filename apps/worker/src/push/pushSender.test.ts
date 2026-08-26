import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  pushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
};

const mockSendEachForMulticast = vi.fn();
const mockGetMessaging = vi.fn(() => ({ sendEachForMulticast: mockSendEachForMulticast }));
const mockGetFirebaseApp = vi.fn(() => ({}));
const mockIsFirebaseConfigured = vi.fn(() => true);

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: mockGetMessaging }));
vi.mock("./firebaseCredential.js", () => ({ getFirebaseApp: mockGetFirebaseApp }));
vi.mock("@noteschain/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@noteschain/push")>()),
  isFirebaseConfigured: mockIsFirebaseConfigured,
}));

const { sendPushToUser } = await import("./pushSender.js");

const RENDERED = { title: "New comment", body: "Someone commented on your note.", deepLink: "/note/pub-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsFirebaseConfigured.mockReturnValue(true);
});

describe("sendPushToUser", () => {
  it("throws when Firebase isn't configured, rather than silently no-op'ing", async () => {
    mockIsFirebaseConfigured.mockReturnValue(false);

    await expect(sendPushToUser("user-1", RENDERED)).rejects.toThrow(/Firebase is not configured/);
    expect(mockPrisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  it("is a normal success with zero devices — most Keepers never install the app", async () => {
    mockPrisma.pushToken.findMany.mockResolvedValue([]);

    const result = await sendPushToUser("user-1", RENDERED);

    expect(result).toEqual({ delivered: 0, pruned: 0 });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it("sends one multicast call carrying every registered token", async () => {
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { id: "t1", token: "fcm-token-1" },
      { id: "t2", token: "fcm-token-2" },
    ]);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      responses: [{ success: true }, { success: true }],
    });

    const result = await sendPushToUser("user-1", RENDERED);

    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ["fcm-token-1", "fcm-token-2"],
      notification: { title: RENDERED.title, body: RENDERED.body },
      data: { deepLink: RENDERED.deepLink },
      android: {
        notification: {
          channelId: "noteschain-alerts-v1",
          sound: "noteschain_calm_signal.wav",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "noteschain_calm_signal.wav",
          },
        },
      },
    });
    expect(result).toEqual({ delivered: 2, pruned: 0 });
    expect(mockPrisma.pushToken.deleteMany).not.toHaveBeenCalled();
  });

  it("prunes only the tokens FCM reports as permanently unregistered", async () => {
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { id: "t1", token: "fcm-token-1" },
      { id: "t2", token: "fcm-token-2" },
      { id: "t3", token: "fcm-token-3" },
    ]);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: "messaging/registration-token-not-registered", message: "gone" } },
        // A transient/unrelated error must NOT be pruned — retrying it later might succeed.
        { success: false, error: { code: "messaging/internal-error", message: "try again" } },
      ],
    });

    const result = await sendPushToUser("user-1", RENDERED);

    expect(mockPrisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["t2"] } } });
    expect(result).toEqual({ delivered: 1, pruned: 1 });
  });
});
