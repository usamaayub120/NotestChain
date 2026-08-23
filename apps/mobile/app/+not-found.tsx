import { Linking } from "react-native";
import { usePathname, router } from "expo-router";
import { Action, Screen, Subtitle, Title } from "@/src/components/ui";
import { webOrigin } from "@/src/lib/config";

/**
 * The Android App Links intent filter claims all of noteschain.org/* — so any
 * page the app doesn't have a screen for (marketing, admin, tags, etc.) can
 * land here rather than a blank router error.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();
  return <Screen>
    <Title>This isn't in the app yet</Title>
    <Subtitle>That page is only available on the NotesChain website.</Subtitle>
    <Action title="Open on the website" onPress={() => void Linking.openURL(`${webOrigin}${pathname}`)} />
    <Action title="Back to NotesChain" tone="secondary" onPress={() => router.replace("/")} />
  </Screen>;
}
