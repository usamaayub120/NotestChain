# MOBILE_APP_STRATEGY.md — NotesChain

The MVP is a responsive web app only. This document is the future path for
wrapping it natively — nothing here is built yet, and none of it should
change how the web app is built today beyond the constraints already baked
into `DESIGN_SYSTEM.md`/`UI_IMPLEMENTATION_PLAN.md` (safe-area insets,
no-hover-dependence, relative API paths, offline-safe drafts).

## 1. Wrapping approach: Capacitor

Capacitor loads the same built `apps/web/dist` inside a thin native shell
(WKWebView on iOS, Android System WebView/Chromium on Android) and exposes
native APIs as needed. Preferred over React Native/Expo here because it
requires **zero frontend rewrite** — the existing React app becomes the
Capacitor `webDir`.

```
apps/mobile/            (future, not in MVP)
  capacitor.config.ts    webDir: '../web/dist', server.androidScheme: 'https'
  ios/                    generated Xcode project
  android/                generated Gradle project
```

## 2. Required native configuration (when built)

- `capacitor.config.ts`: `server.url` pointed at the production origin in
  dev-against-remote mode, or bundled `dist` for fully offline-capable
  shipped builds — decide per release; bundling `dist` avoids a network
  dependency for app launch and is the default recommendation.
- iOS: `Info.plist` — `NSAppTransportSecurity` (HTTPS only), safe-area
  handled automatically by WKWebView + our CSS `env(safe-area-inset-*)`.
- Android: `AndroidManifest.xml` — `usesCleartextTraffic=false`,
  `android:windowSoftInputMode="adjustResize"` (required so the on-screen
  keyboard resizes the WebView instead of covering the focused input — the
  web app's own keyboard-safe CSS assumes this mode).

## 3. Cookies and sessions in a WebView

`HttpOnly` session + CSRF cookies work inside a Capacitor WebView as long as
requests stay same-origin (Capacitor's `server.androidScheme: 'https'` +
serving from the real API origin makes this "same origin" in the cookie
sense). No token needs to move to native storage. If Apple/Google review
friction ever requires a native-feeling login (e.g. biometric unlock of an
already-established session), that would be an additive native module, not
a change to the session model.

## 4. Deep links

Standard Universal Links (iOS) / App Links (Android) map `https://<domain>/p/:id`,
`/@:username`, `/tags/:tag` directly to the same React Router routes already
in the SPA — no separate native routing table needed since the WebView is
just rendering the web app's own router.

## 5. Safe areas

Already handled at the CSS layer (`env(safe-area-inset-*)` in
`MobileAppShell`/`MobileBottomNavigation`) — Capacitor doesn't require
anything additional beyond `viewport-fit=cover` in the meta viewport tag,
which the web app should already set regardless of wrapper, since real
notched phones' mobile Safari/Chrome need it too.

## 6. File and image uploads

Not in the MVP (no avatar upload endpoint yet — `avatarUrl` is a plain URL
field). When added: use the browser's native `<input type="file">` first
(works inside Capacitor WebViews without a plugin); only reach for
`@capacitor/camera`/`@capacitor/filesystem` if a genuinely native picker
(camera roll, live camera) becomes a product requirement.

## 7. Push notifications

Out of scope for MVP and not currently planned. If added later:
`@capacitor/push-notifications` + APNs/FCM, but this requires a server-side
notification module (not part of the current Express API) — treat as its
own additive phase, not a wrapper concern.

## 8. App Store / Play Store considerations

- Apple: WebView-wrapped apps are permitted (Guideline 4.2) as long as the
  app provides substantive native-feeling functionality and isn't a bare
  bookmark; a bottom tab bar that already exists in the design and any one
  native touch (share sheet, native back gesture handling) generally
  clears this.
- Google: fewer restrictions on WebView wrapping, but Trusted Web Activity
  (TWA) is worth evaluating as an even-lighter alternative to full
  Capacitor for Android specifically if no native plugin is ever needed.
- Both stores require a privacy policy; NotesChain's must disclose that
  anonymous publications are not anonymous to the platform (matches the
  product principle already in `ARCHITECTURE.md` §2.3 — don't let store
  copy overclaim what the UI itself doesn't).

## 9. What eventually benefits from native

- Camera-based avatar capture.
- Push notifications for moderation decisions ("your submission was
  approved").
- Share-sheet integration for sharing a publication (works today via the
  Web Share API inside a WebView with no native code needed — only revisit
  if that proves insufficient).
- Biometric re-auth for returning users.

None of these block shipping the wrapper; they're independent, additive
native modules.

## 10. Risks of depending entirely on a WebView

- App Store rejection risk if the wrapper reads as "just a website" with no
  native touches — mitigated by the bottom nav, safe-area handling, and
  Web Share API already being part of the base design.
- WebView engine differences (especially older Android System WebView
  versions) — mitigated by keeping the web app's JS/CSS baseline
  conservative (no bleeding-edge CSS the design system doesn't already
  require) and testing on an actual low-end Android device, not just
  Chrome desktop emulation.
- Network dependency for any content not bundled — mitigated by bundling
  the built `dist` into the native binary (§2) rather than always fetching
  from a remote origin, and by the offline-safe draft handling already
  required in the base web app.
- Single shared frontend codebase is the entire point of this approach — no
  parallel native UI to keep in sync, which is the risk this strategy is
  chosen specifically to avoid.
