export interface RenderedPush {
  title: string;
  /** Plain text — FCM notification bodies don't render markup. */
  body: string;
  /**
   * An `expo-router`-style path, e.g. `/note/abc123`. The mobile app's
   * `noteschain://` scheme resolves this to the matching screen
   * automatically on tap; no separate deep-link routing table needed.
   */
  deepLink: string;
}
