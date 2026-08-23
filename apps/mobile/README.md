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
- iOS builds/submission and Play Store submission both need external
  accounts (Apple Developer Program, Google Play Console) that aren't set up
  yet — `eas.json` has no `ios` build profile and an empty `submit.production`
  block until those exist.
- EAS Build/Submit and OTA updates are explicit, owner-directed release
  actions — never run automatically by CI or by an agent without being asked.
