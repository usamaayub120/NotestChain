# NotesChain mobile

Expo managed React Native application. Run `pnpm --filter @noteschain/mobile start` after installing workspace dependencies. Production Android delivery uses `eas build --platform android --profile production`; configure the EAS project, Play developer credentials, store assets, privacy policy, Data Safety declaration, and Play listing before submission.

The app uses only `https://noteschain.org/api/v1`; it never receives a Solana private key. Native sessions are opaque bearer tokens in SecureStore and offline mutations are replayed with an idempotency key. Publishing is intentionally online-only and requires a fresh confirmation.
