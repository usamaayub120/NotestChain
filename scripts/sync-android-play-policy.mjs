import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const PLAY_PACKAGE = "org.noteschain.app";
const PLAY_TRACK = "internal";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function positiveVersionCode(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new Error("ANDROID_VERSION_CODE must be a positive integer.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 2_147_483_647) {
    throw new Error("ANDROID_VERSION_CODE must fit in a signed 32-bit integer.");
  }
  return parsed;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccountJwt(serviceAccount) {
  if (typeof serviceAccount.client_email !== "string" || typeof serviceAccount.private_key !== "string") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not a Google service-account JSON key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedClaims = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: PLAY_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(serviceAccount.private_key).toString("base64url")}`;
}

async function accessToken(serviceAccount) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountJwt(serviceAccount),
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth token request failed (${response.status}).`);
  const payload = await response.json();
  if (!payload || typeof payload.access_token !== "string") throw new Error("Google OAuth token response was invalid.");
  return payload.access_token;
}

function releaseHasVersionCode(release, versionCode) {
  return Array.isArray(release?.activeArtifacts) &&
    release.activeArtifacts.some((artifact) => artifact?.versionCode === versionCode);
}

async function isAvailableToTesters(token, versionCode) {
  const url = new URL(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/tracks/${PLAY_TRACK}/releases`,
  );
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Play release lookup failed (${response.status}).`);
  const payload = await response.json();
  return Boolean(payload?.releases?.some(
    (release) => release?.releaseLifecycleState === "RELEASE_LIFECYCLE_STATE_PUBLISHED" && releaseHasVersionCode(release, versionCode),
  ));
}

async function syncPolicy(versionCode, versionName, policyToken) {
  const origin = (process.env.NOTESCHAIN_API_ORIGIN ?? "https://noteschain.org").replace(/\/$/, "");
  const response = await fetch(`${origin}/api/v1/internal/release-policy/android/latest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-noteschain-release-policy-token": policyToken,
    },
    body: JSON.stringify({ latestBuild: versionCode, latestVersion: versionName }),
  });
  if (!response.ok) throw new Error(`NotesChain release-policy update failed (${response.status}).`);
  const payload = await response.json();
  if (!payload?.data?.android) throw new Error("NotesChain release-policy update returned invalid JSON.");
  console.log(`Synced Android latest build ${payload.data.android.latestBuild}; minimum remains ${payload.data.android.minimumBuild}.`);
}

const versionCode = positiveVersionCode(required("ANDROID_VERSION_CODE"));
const versionName = required("ANDROID_VERSION_NAME");
const policyToken = required("NOTESCHAIN_RELEASE_POLICY_TOKEN");
if (versionName.length > 64) throw new Error("ANDROID_VERSION_NAME must be 64 characters or fewer.");

let serviceAccount;
try {
  serviceAccount = JSON.parse(required("GOOGLE_SERVICE_ACCOUNT_KEY"));
} catch {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
}

const token = await accessToken(serviceAccount);
const pollOnce = process.env.POLL_ONCE === "true";
const intervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS ?? "300");
const maxWaitSeconds = Number(process.env.MAX_WAIT_SECONDS ?? "14400");
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || !Number.isInteger(maxWaitSeconds) || maxWaitSeconds < 0) {
  throw new Error("POLL_INTERVAL_SECONDS must be at least 30 and MAX_WAIT_SECONDS must be non-negative integers.");
}

const deadline = Date.now() + maxWaitSeconds * 1000;
for (;;) {
  if (await isAvailableToTesters(token, versionCode)) {
    await syncPolicy(versionCode, versionName, policyToken);
    break;
  }
  if (pollOnce || Date.now() >= deadline) {
    throw new Error(`Android build ${versionCode} is not yet available on Google Play's internal track; policy was not changed.`);
  }
  console.log(`Android build ${versionCode} is still processing in Google Play; checking again in ${intervalSeconds} seconds.`);
  await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
}
