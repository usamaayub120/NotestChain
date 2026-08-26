import { getMessaging } from "firebase-admin/messaging";
import { isFirebaseConfigured } from "@noteschain/push";
import type { RenderedPush } from "@noteschain/push";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { getFirebaseApp } from "./firebaseCredential.js";

/**
 * FCM's "this registration no longer exists" family of errors — always
 * permanent (the app was uninstalled, the token rotated, sign-out cleared
 * it). Retrying these would never succeed, so the token is pruned instead
 * of letting the job retry against it forever.
 */
const UNREGISTERED_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
const ANDROID_NOTIFICATION_CHANNEL_ID = "noteschain-alerts-v1";
const NOTIFICATION_SOUND = "noteschain_calm_signal.wav";

export interface SendResult {
  /** How many devices actually received it — 0 with no error is a normal outcome (nobody has the app installed). */
  delivered: number;
  pruned: number;
}

/**
 * Sends one rendered push to every device currently registered for
 * `userId`. Raw native FCM registration tokens (from expo-notifications'
 * getDevicePushTokenAsync), sent directly via Firebase Admin — there is no
 * Expo push-relay service in this path.
 *
 * A user with zero registered devices is success, not failure: most
 * Keepers will never have installed the mobile app at all, and that must
 * never make a PushJob retry forever. A genuine send failure (bad
 * credentials, FCM unreachable) throws, which the caller turns into a
 * normal retry-with-backoff, same as an EmailJob's SMTP failure.
 */
export async function sendPushToUser(userId: string, rendered: RenderedPush): Promise<SendResult> {
  if (!isFirebaseConfigured(env)) {
    throw new Error("Firebase is not configured (FIREBASE_SERVICE_ACCOUNT_PATH/_JSON).");
  }

  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { id: true, token: true } });
  if (tokens.length === 0) return { delivered: 0, pruned: 0 };

  const messaging = getMessaging(getFirebaseApp());
  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: rendered.title, body: rendered.body },
    data: { deepLink: rendered.deepLink },
    android: {
      notification: {
        channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
        sound: NOTIFICATION_SOUND,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: NOTIFICATION_SOUND,
        },
      },
    },
  });

  const staleIds: string[] = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (code && UNREGISTERED_ERROR_CODES.has(code)) {
      staleIds.push(tokens[index]!.id);
    } else {
      logger.warn({ userId, code, message: result.error?.message }, "Push delivery failed for one device");
    }
  });

  if (staleIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: staleIds } } });
    logger.info({ userId, count: staleIds.length }, "Pruned stale push tokens");
  }

  return { delivered: response.successCount, pruned: staleIds.length };
}
