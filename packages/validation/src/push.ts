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

export const registerPushInstallationSchema = z.object({
  installationId: z.string().uuid(),
  credential: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  token: z.string().min(1).max(4096),
  platform: z.enum(["IOS", "ANDROID"]),
  productOptIn: z.boolean(),
  activityAlertsOptIn: z.boolean(),
  permissionGranted: z.boolean(),
  timeZone: z.string().trim().min(1).max(64).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
});

export const recordCampaignOpenSchema = z.object({
  installationId: z.string().uuid(),
  credential: z.string().min(43).max(128),
  deliveryToken: z.string().min(32).max(128),
});
export type RegisterPushInstallationInput = z.infer<typeof registerPushInstallationSchema>;
