# NotesChain mobile

Expo (SDK 52) / React Native app with its own UI — **not** a WebView wrapper
around `apps/web`. The two clients share the same API but are otherwise
independent codebases; see `ARCHITECTURE.md` for the platform overview.

## Running locally

```
pnpm --filter @noteschain/mobile start
```

Copy `.env.example` to `.env` to point a local `expo start` session at
something other than production (see "Environments" below).

## Architecture

- **Auth**: opaque bearer tokens in `expo-secure-store` (`src/lib/api.ts`),
  not cookies — native sessions use a separate `/auth/mobile/*` surface from
  the web app's cookie-based session.
- **Offline**: `src/lib/offline.ts` is a SQLite-backed cache plus a mutation
  queue; `src/lib/sync.ts` replays queued mutations on reconnect, each with
  an `Idempotency-Key` so a retried write can't double-apply.
- **Publishing is intentionally online-only** and requires a fresh
  confirmation (`draft/[id].tsx`'s publish sheet) — it is never queued
  through the offline mutation path, unlike bookmarks/comments/autosave.
- **Theming**: `src/lib/theme.tsx` provides light/dark palettes; `ui.tsx`'s
  primitives all consume it via `useTheme()` rather than static colors.
- **Onboarding**: `app/onboarding.tsx` sets expectations about the
  draft → review → permanent-publish lifecycle before a first-time user
  writes anything; gated in `index.tsx` and `draft/new.tsx` via
  `src/lib/first-run.ts`.
- **Android update policy**: `src/hooks/use-app-version-check.ts` checks the
  installed Android `versionCode` at launch and on foreground, using the
  public API policy. A failed/malformed policy check is fail-open; an older
  build below the configured minimum replaces the navigator with an
  non-dismissible update gate.

## Environments

`app.config.ts` resolves `APP_ENV` (`development` | `preview` | `production`,
default `production`) into `extra.apiOrigin`/`extra.webOrigin`, read at
runtime via `src/lib/config.ts`. There is no separate staging deployment
today — `preview` builds point at production (`noteschain.org`) with a
visible non-production badge in Settings; use a test account. `development`
can be pointed at a LAN API via a local `.env` (see `.env.example`), which
`expo start` loads automatically.

## Testing

```
pnpm --filter @noteschain/mobile lint
pnpm --filter @noteschain/mobile typecheck
pnpm --filter @noteschain/mobile test
```

Unit tests (`jest-expo`) cover `src/lib/*`. There is no E2E suite yet.

## Building & releasing

- `eas build --profile preview --platform android` — internal APK, no store
  account required. This is the profile used for day-to-day debug testing.
- `eas build --profile production --platform android` — Play Store bundle.
- `eas.json` uses EAS remote app-version management and sets
  `production.autoIncrement: true`, so every production Android build gets a
  new `versionCode`. Its production submission profile targets Google Play's
  **Internal testing** track.
- EAS Build/Submit and OTA updates are explicit, owner-directed release
  actions — never run automatically by CI or by an agent without being asked.

### Android minimum-build policy

The API exposes `GET /api/v1/app/version` as:

```json
{
  "data": {
    "android": {
      "latestBuild": 20,
      "minimumBuild": 17,
      "latestVersion": "1.3.0"
    }
  }
}
```

The values come from the API/container environment, not from the mobile
binary: `ANDROID_LATEST_BUILD`, `ANDROID_MINIMUM_BUILD`, and
`ANDROID_LATEST_VERSION` (documented in the root `.env.example`). Build
numbers are Android `versionCode` values; `latestVersion` is display copy
only. `latestBuild` and `minimumBuild` must stay independent:

- Set `latestBuild` to a newly available Play build and leave
  `minimumBuild` unchanged for an optional update.
- Raise `minimumBuild` only when that already-available Play build is
  required. Builds below it are blocked, while builds from the minimum up to
  (but not including) latest see the optional prompt.

Release order is a safety requirement: run local checks, build the AAB,
submit it to Play Internal Testing, wait until that exact `versionCode` is
available to testers, then deploy/restart the API with the new policy. Never
raise `ANDROID_MINIMUM_BUILD` while Google Play is still processing the AAB,
or users can be blocked before an update exists.
