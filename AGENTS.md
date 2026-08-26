# NotesChain deployment guide for agents

This repository contains **two clients that share one API**. Do not replace
one with the other or deploy the mobile application as website assets.

## Non-negotiable release gate

**Test locally before every VPS or native release.** Do not push to `main`,
submit an EAS build, or recreate the production container while relevant local
typechecks, builds, migrations, and tests are failing or have not been run.
Run the relevant checks, record any environmental limitation, fix application
failures first, then deploy. After deployment, repeat the production smoke
checks in this file; a successful build alone is not a release verification.

| Surface | Source | How it ships | Purpose |
| --- | --- | --- | --- |
| Website | `apps/web` | Built into the Docker image and served by Nginx | Public reader, browser accounts, writer UI, PWA, and all admin/moderation. This is a Vite/React SPA, not a Next.js app. |
| API + worker | `apps/api`, `apps/worker`, `prisma` | Same Docker image, supervised alongside Nginx | Website and native-app backend, database access, Solana publishing. |
| Native app | `apps/mobile` | Expo/EAS Android AAB now; iOS later | Native reader/account/writing experience. It calls `https://noteschain.org/api/v1` directly. It is deliberately excluded from the Docker image. |

## Current mobile integration contract

- Browser authentication remains HTTP-only cookie based. Native sessions are
  opaque bearer tokens stored only in Expo SecureStore. Never change the
  browser session flow to make mobile work.
- The API routes under `/api/v1/auth/mobile/*` are for the native client.
  Bearer-token writes bypass browser CSRF only after the server has verified
  that the session has `transport = MOBILE`.
- Native unique-reader events send `X-NotesChain-Visitor`; only its one-way
  server-side hash is retained. Do not add device fingerprinting or IP-based
  identifiers.
- The native registration/comment CAPTCHA opens the first-party web route
  `/mobile-captcha`, which returns to the `noteschain://` app scheme. Keep
  this route in the web build whenever native registration or comments are
  enabled. Its allow-list must remain restricted to app-owned callback routes.
- Native publishing is online-only and must keep the explicit irreversible
  confirmation. The app never receives a Solana private key.
- Mobile administration/moderation remains on the responsive website.
- Push notifications go through Firebase Cloud Messaging directly — the
  worker holds a Firebase service account credential
  (`FIREBASE_SERVICE_ACCOUNT_PATH`/`_JSON`, see `.env.example`) and calls
  FCM via `firebase-admin`. There is no Expo push-relay service in this
  design: the app registers its raw native FCM token
  (`expo-notifications`' `getDevicePushTokenAsync`, not an Expo push token),
  which requires `apps/mobile/google-services.json` (gitignored, a
  different file from the Firebase service account key) to be present at
  build time. Missing Firebase config never blocks anything else — the API
  queues `PushJob` rows regardless, and the worker just logs a warning and
  lets them retry with backoff (see `packages/push`).

## Changes that require a VPS release

Deploy the Docker image when a change touches any of these:

- `apps/web` — including the mobile CAPTCHA bridge, PWA, or website UI.
- `apps/api`, `apps/worker`, `packages/*`, `prisma`, Docker/Nginx, or API
  behaviour used by the mobile app.

The mobile app cannot use new API routes until this VPS release is live. In
particular, the current mobile bearer-session schema and idempotency changes
require both the image update and the Prisma migrations:

- `20260819180000_add_mobile_sessions`
- `20260819181000_add_idempotency_keys`

### Production VPS release procedure

1. Run appropriate checks locally. At minimum for mobile/API work:

   ```powershell
   pnpm run db:generate
   pnpm --filter @noteschain/api typecheck
   pnpm --filter @noteschain/mobile typecheck
   pnpm --filter @noteschain/web build
   $env:DATABASE_URL='postgresql://postgres:password@localhost:5432/noteschain_test'
   pnpm --filter @noteschain/api test -- mobileAuth.test.ts
   ```

   The mobile workspace uses the repository ESLint configuration directly;
   do not replace it with Expo's interactive lint setup during a release.

2. Commit the approved change and push it to `main`. GitHub Actions runs the
   tests, then builds and publishes the single web/API/worker image to
   `ghcr.io/usamaayub120/notestchain:latest`. CI **does not deploy** to the
   VPS.

3. Read the operator SSH config at `~/.codex/ssh-config.toml`; do not hardcode
   credentials or print secret files. On the shared VPS, touch only:

   - `/opt/noteschain/*`
   - the `noteschain` container
   - the `noteschain.org`/`notes.usamaayub.com` Nginx site configuration when
     a domain/routing change genuinely requires it.

   Never alter the unrelated containers, shared Postgres container, or other
   VPS projects.

4. Pull and recreate only NotesChain:

   ```sh
   docker pull ghcr.io/usamaayub120/notestchain:latest
   cd /opt/noteschain && docker compose up -d
   docker exec noteschain sh -c 'cd /app && node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
   ```

   Do not run `prisma migrate dev`, database reset commands, or seed commands
   against production. Do not expose or move the mounted Solana publisher key
   at `/home/codexops/noteschain/secrets/solana-publisher.json`, or (once it
   exists) the Firebase service account key mounted the same way at
   `/home/codexops/noteschain/secrets/firebase-service-account.json` and
   bind-mounted to `/run/secrets/firebase-service-account.json` — see
   `README.md`'s deployment section for adding a new mounted secret.

5. Verify before declaring success:

   - `https://noteschain.org/health` and `/api/v1/health/ready` are healthy.
   - Container logs show API and worker running without migration errors.
   - Browser website still loads, including `/mobile-captcha`.
   - A mobile bearer login/refresh/logout works; browser-cookie login still
     works; unique views deduplicate; writer analytics remain isolated.
   - PWA update banner appears after a subsequent web deployment.

## Native release procedure (separate from the VPS)

Do **not** require or attempt an EAS/Play release merely because the VPS was
redeployed. Native JavaScript can point at the newly deployed API only after
the VPS step above; shipping an Android binary is a separate, paid-store
workflow.

Before the first Google Play release:

1. The owner completes Play Console account registration, payment, identity,
   terms, and any required Data Safety declarations. An agent must pause for
   payment, legal agreement, or identity-verification confirmation. Register
   the **Developer name as "FreeSoul"** — that's the legal/operating entity
   named throughout the app's Privacy Policy and Terms of Service (see
   `packages/shared/src/brand.ts`'s `legalEntity`), not the `usamaayub00` EAS
   account username.
2. Configure the EAS project, Android signing, store listing, screenshots,
   support contact (`support@noteschain.org`), privacy-policy URL
   (`https://noteschain.org/privacy` — live), content rating, and versioning.
   Do not commit credentials, keystores, service-account JSON, or EAS tokens.
3. Add the real Android signing-certificate fingerprint to
   `https://noteschain.org/.well-known/assetlinks.json` before claiming Android
   App Links are verified. Add the corresponding Apple association file before
   iOS Universal Links are enabled. `app.json` declares the intent filters,
   but domain association is not complete without these web-hosted files.
4. Run emulator/device smoke tests for login, registration CAPTCHA return,
   draft editing/offline sync, online publish confirmation, comments,
   bookmarks, deep links, and Android back navigation.
5. Build an AAB with:

   ```sh
   pnpm --filter @noteschain/mobile start
   eas build --platform android --profile production
   ```

   Use EAS Update only for JavaScript/UI changes compatible with the already
   installed native runtime. A dependency, permission, plugin, package-name,
   or native configuration change requires a new Play Store build.
6. Use internal/closed testing and the Play pre-launch report before a public
   rollout. EAS/Play publication is an explicit external release action; do
   not make it without the owner's direction.

Push notifications add two GitHub Actions secrets `.github/workflows/eas-android-release.yml`
requires before a build succeeds: `GOOGLE_SERVICES_JSON` (the Firebase
Android client config) and, on the worker side of a VPS deploy,
`FIREBASE_SERVICE_ACCOUNT_PATH` pointing at a mounted service account key
(see the VPS release procedure above). Both come from the same Firebase
project, but are two different files — see the comment atop that workflow
file for exactly where each one comes from in the Firebase console.

### Legal pages and account deletion (already implemented)

`/privacy`, `/terms`, and `/delete-account` exist on `apps/web` (linked from
its footer and from `apps/mobile`'s Settings screen), registration on both
clients requires accepting them (`acceptedTerms` on `registerSchema`), and
`DELETE /api/v1/auth/account` (`deleteOwnAccount` in
`apps/api/src/modules/auth/auth.service.ts`) gives users real self-service
account/data deletion — Google Play requires both an in-app path and a
public web page for this, not just a contact email, for any app that
supports account creation. It's a soft delete (flips `AccountStatus` to
`DELETED`, scrubs the account's email/password/comment name, prunes
never-published drafts, deletes every `Follow` row in both directions, and
scrubs the optional profile fields — bio, avatar, links, location,
pronouns, birth date, gender — from any byline it can't hard-delete)
rather than a hard row delete: `Publication` and `Comment` hold required,
`ON DELETE RESTRICT` foreign keys to `User`, so the database itself refuses
to fully delete anyone who ever published or commented — already-published
content and its byline (the display name and username themselves, not the
profile embellishment around them) stay exactly as published, which is
this product's core permanence promise, not a compliance gap. The Privacy
Policy states this plainly as the one exception to "delete my data."

For the Play Console **Data Safety** form, the inventory to transcribe:

| Data | Collected | Shared with | Purpose |
| --- | --- | --- | --- |
| Email address | Yes | Email delivery provider (for delivery only) | Account, password reset |
| Password | Yes, hashed (Argon2id), never shared | — | Account authentication |
| Username + display name (Keeper profile, created at registration) | Yes, always | Public | Attribution on published notes/comments; profile address |
| Pen name(s): username, display name, optional bio/avatar URL/links | Yes, only if the user creates one | Public (if published under it) | An alternate byline, unlinkable by readers to the Keeper profile |
| Location, pronouns (Keeper profile or a pen name) | Optional, user-entered | Public, only if set | Profile context the user chooses to share |
| Birth date, gender (Keeper profile or a pen name) | Optional, user-entered | Public, only if the user separately turns on that field's own "show on profile" toggle | Profile context the user chooses to share |
| Draft/note content | Yes | Public, only once published | The product itself |
| Follow graph (who a Keeper follows) | Yes | Never shared — not even shown to the followed account, and visible only to the Keeper who made it | Powers the Following feed |
| Device identifier (random, per-device) | Yes | — (one-way hashed server-side) | De-duplicating unique-reader counts, not advertising |
| Push notification token | Yes, only if the user grants notification permission | Google/Firebase (FCM, delivery only — see `packages/push`) | Comment/moderation/follow/kept-note alerts. Deleted on sign-out and on account deletion; never shared for advertising. |
| IP address | Yes, in server logs only | — | Security/abuse prevention |
| Content published to the public Solana blockchain | Yes (title, excerpt, content hash — not the raw body for v2) | Public, permanently | Independent, third-party-verifiable proof a note existed at a given time |

Location, birth date, gender, and the push notification token are the
fields this table didn't carry before the Keeper/pen-name identity model
and the push notification feature — re-run the Data Safety declaration and
confirm the Privacy Policy names them before shipping a build that offers
them. No contacts, photos/camera, or financial data are collected. No
advertising or third-party data sale. Cloudflare Turnstile (bot-check at
registration/comments), the email provider, and Google/Firebase (push
delivery) are the third parties involved, besides the Solana network
itself.

## Safety and source-of-truth notes

- `README.md` contains the current Docker/VPS operational details; `RUNBOOK.md`
  covers Solana authorities and publisher-key handling. Keep all three docs in
  sync if deployment architecture changes.
- The image name is intentionally `notestchain` (the existing GHCR repository
  spelling), while the container/domain/source project use `noteschain`. Do
  not “correct” one without migrating the actual registry configuration.
- Preserve the scope boundary: a web release is reversible by redeploying the
  previous image; migrations must be reviewed first; Play publishing, payment,
  identities, and legal acknowledgements require the owner.
