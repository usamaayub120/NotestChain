/**
 * The three families DESIGN_SYSTEM.md §4 assigns one job each.
 *
 * None of them were in the app. There was no expo-font dependency, no
 * useFonts call, and no font assets -  and `fontFamily: "serif"` appeared
 * nine times as the display face, which resolves to Noto Serif on Android
 * and Times on iOS. So the brand rendered in two different typefaces,
 * neither of them the brand's, and both of them the
 * cream-background/serif template §2 says it deliberately sidestepped by
 * "changing the type axis instead".
 *
 * Imported per weight rather than from each package's index. The index
 * re-exports every weight the family ships, and Metro bundles what the
 * module graph references -  importing from it put 54 TTFs in the Android
 * export when 9 are used, which is megabytes of dead weight in the APK.
 * Each weight folder ships its own typed entry point, so this stays type
 * safe; the raw .ttf paths do not, because nothing declares that module.
 */
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_400Regular_Italic } from "@expo-google-fonts/figtree/400Regular_Italic";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";

export const APP_FONTS = {
  // Display: headings, the wordmark, section labels. Never body copy (§4).
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  // UI and body: everything a reader reads, every control, every field.
  Figtree_400Regular,
  Figtree_400Regular_Italic,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  // Proof values only: signatures, PDAs, hashes. Never prose (§4).
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};

/** The family names to pass to `fontFamily`, by the job §4 assigns them. */
export const fonts = {
  display: "BricolageGrotesque_700Bold",
  displaySemi: "BricolageGrotesque_600SemiBold",
  body: "Figtree_400Regular",
  bodyItalic: "Figtree_400Regular_Italic",
  medium: "Figtree_500Medium",
  semibold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
  proof: "IBMPlexMono_400Regular",
  proofMedium: "IBMPlexMono_500Medium",
} as const;
