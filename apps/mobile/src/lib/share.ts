import { Share } from "react-native";
import { appName, webOrigin } from "@/src/lib/config";

export type NoteShareContent = { title: string; message: string; url: string };

/**
 * Builds the payload for sharing a published note.
 *
 * React Native's Android implementation of Share.share reads only `message` —
 * `url` is iOS-only, and `title` is just the chooser heading. Sending a url
 * with no message dispatches an intent whose EXTRA_TEXT is empty, which share
 * targets surface as "cannot share empty message". So `message` is always set
 * and never empty, and `url` is kept alongside it for iOS.
 *
 * Pure and exported on purpose: this is the part that was wrong, so it is the
 * part worth having a test around.
 */
export function noteShareContent(title: string, publicationId: string): NoteShareContent {
  const url = `${webOrigin}/p/${publicationId}`;
  const heading = title.trim();
  return {
    // A draft published without a title would otherwise lead the message with
    // a bare newline.
    title: heading || appName,
    message: heading ? `${heading}\n${url}` : url,
    url,
  };
}

export async function shareNote(title: string, publicationId: string): Promise<void> {
  await Share.share(noteShareContent(title, publicationId));
}
