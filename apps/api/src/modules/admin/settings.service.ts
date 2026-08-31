import type { SiteSettings } from "@prisma/client";
import type { SyncAndroidLatestBuildInput, UpdateSiteSettingsInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/apiError.js";

const SETTINGS_ID = 1;

// The SEO router (apps/api/src/modules/seo) reads this on every public page
// load, so it's cached in memory rather than hitting Postgres per request.
// Invalidated on every admin update; otherwise reused for the process
// lifetime.
let cached: SiteSettings | null = null;

async function loadSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  // Lazily create the singleton row on first read rather than seeding it via
  // migration data — keeps the migration itself schema-only.
  return prisma.siteSettings.create({ data: { id: SETTINGS_ID } });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cached) return cached;
  cached = await loadSettings();
  return cached;
}

/** Test-only: resetTestDb() deletes the row directly, bypassing this cache. */
export function resetSiteSettingsCacheForTests(): void {
  cached = null;
}

// A blank field means "clear it," not "leave it alone" — this is a full-form
// PATCH (the admin UI always submits every field together), so an absent or
// empty string becomes an explicit `null` rather than being left untouched.
function toNullableString(value: string | undefined): string | null {
  return value ? value : null;
}

export async function updateSiteSettings(
  adminUserId: string,
  input: UpdateSiteSettingsInput,
  ipAddress?: string,
): Promise<SiteSettings> {
  const twitterHandle = input.twitterHandle
    ? input.twitterHandle.startsWith("@")
      ? input.twitterHandle
      : `@${input.twitterHandle}`
    : null;

  const data = {
    ga4MeasurementId: toNullableString(input.ga4MeasurementId),
    searchConsoleVerification: toNullableString(input.searchConsoleVerification),
    defaultMetaDescription: toNullableString(input.defaultMetaDescription),
    defaultOgImageUrl: toNullableString(input.defaultOgImageUrl),
    twitterHandle,
    indexingEnabled: input.indexingEnabled,
    androidLatestBuild: input.androidLatestBuild,
    androidMinimumBuild: input.androidMinimumBuild,
    androidLatestVersion: input.androidLatestVersion,
  };

  const current = await getSiteSettings();
  const completeData = {
    ...data,
    androidLatestBuild: data.androidLatestBuild ?? current.androidLatestBuild,
    androidMinimumBuild: data.androidMinimumBuild ?? current.androidMinimumBuild,
    androidLatestVersion: data.androidLatestVersion ?? current.androidLatestVersion,
  };

  if (completeData.androidMinimumBuild > completeData.androidLatestBuild) {
    throw Errors.badRequest("Minimum Android build must not exceed the latest Android build.");
  }

  const updated = await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...completeData },
    update: completeData,
  });
  cached = updated;

  await recordAudit({
    actorUserId: adminUserId,
    action: "SITE_SETTINGS_UPDATED",
    targetType: "SiteSettings",
    targetId: String(SETTINGS_ID),
    metadata: completeData,
    ipAddress,
  });

  return updated;
}

/**
 * Advances the public "latest" policy after Play has made a release
 * available. This intentionally cannot alter androidMinimumBuild: forcing an
 * upgrade is a separate, explicit admin decision.
 */
export async function syncAndroidLatestBuild(
  input: SyncAndroidLatestBuildInput,
  ipAddress?: string,
): Promise<{ settings: SiteSettings; changed: boolean }> {
  const current = await getSiteSettings();

  // Retries are expected from CI. Never let a delayed or duplicated run move
  // the public policy backwards.
  if (input.latestBuild < current.androidLatestBuild) {
    return { settings: current, changed: false };
  }

  const changed =
    input.latestBuild !== current.androidLatestBuild ||
    input.latestVersion !== current.androidLatestVersion;
  if (!changed) return { settings: current, changed: false };

  const updated = await prisma.siteSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      androidLatestBuild: input.latestBuild,
      androidLatestVersion: input.latestVersion,
    },
  });
  cached = updated;

  await recordAudit({
    action: "ANDROID_LATEST_BUILD_SYNCED",
    targetType: "SiteSettings",
    targetId: String(SETTINGS_ID),
    metadata: {
      latestBuild: input.latestBuild,
      latestVersion: input.latestVersion,
      source: "google-play-internal",
    },
    ipAddress,
  });

  return { settings: updated, changed: true };
}
