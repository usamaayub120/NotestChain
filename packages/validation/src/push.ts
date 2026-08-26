import { z } from "zod";

/**
 * `token` is the raw native FCM registration token from the mobile app's
 * expo-notifications getDevicePushTokenAsync() — not an Expo push token
 * (`ExponentPushToken[...]`). There is no Expo push-relay service in this
 * design; the worker sends via Firebase Admin directly.
 */
export const registerPushTokenSchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["IOS", "ANDROID"]),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
