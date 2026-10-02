import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { StatusBar, useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export type AppColors = {
  ink: string; muted: string; border: string; paper: string; surface: string; elevated: string;
  brand: string; canopy: string; glow: string; danger: string; soft: string; success: string;
  notice: string; noticeBorder: string; noticeText: string; iconSoft: string; placeholder: string;
  /**
   * Text and icons sitting ON brand/danger. Was a hardcoded "#fff" in
   * ui.tsx regardless of theme, which is fine in light mode (#b9422b vs
   * white is 5.42:1) and fails in dark: #ff7654 vs white is 2.61:1 and
   * #ff806d vs white is 2.45:1. So in dark mode every primary CTA -  Sign
   * in, Create account, Submit for review, Publish permanently, Delete
   * account -  was below AA.
   *
   * apps/web solved this long ago: DESIGN_SYSTEM.md §3.2 sets
   * --primary-foreground to the dark background colour, because a brighter
   * accent in dark mode carries DARK text. #16151A on #ff7654 is 6.6:1.
   */
  onBrand: string;
  /** DESIGN_SYSTEM.md §3 names these; mobile had neither. */
  verified: string; warning: string;
};

export const lightColors: AppColors = {
  ink: "#201e1b", muted: "#6f695d", border: "#ddd5c4", paper: "#f6f1e8", surface: "#ffffff", elevated: "#fbf8f2",
  // Meets WCAG AA against both the paper background and white button text.
  brand: "#b9422b", canopy: "#1f3327", glow: "#f0c48b", danger: "#c4361f", soft: "#ede7db", success: "#3f6b4c",
  notice: "#fff5de", noticeBorder: "#edd6a7", noticeText: "#765016", iconSoft: "#fce1d9", placeholder: "#78716c",
  onBrand: "#ffffff", verified: "#3f6b4c", warning: "#b8862b",
};

/**
 * Aligned with DESIGN_SYSTEM.md §3.2, which this set previously shared not a
 * single value with -  web dark is a purple-leaning warm-black, mobile's was
 * brown, and side by side they read as two different products.
 *
 * Two were outright bugs rather than drift:
 *   - `elevated` (#1d1a17) was DARKER than `surface` (#24211d), so elevation
 *     ran backwards: a raised card sank.
 *   - `canopy` was a LIGHT green (#a9d4b2) where web's is dark (#142319),
 *     inverting the one atmospheric token.
 */
export const darkColors: AppColors = {
  ink: "#f1ede3", muted: "#9c968a", border: "#34313a", paper: "#16151a", surface: "#1e1d22", elevated: "#26242b",
  brand: "#ff6b45", canopy: "#142319", glow: "#f0c48b", danger: "#e5674a", soft: "#2a2830", success: "#6fa37e",
  notice: "#342b1b", noticeBorder: "#765b2c", noticeText: "#f5d68f", iconSoft: "#422a25", placeholder: "#9c968a",
  // Dark text on the brighter dark-mode accent: 6.6:1, where white was 2.6:1.
  onBrand: "#16151a", verified: "#6fa37e", warning: "#d9a64c",
};

export type FontScalePreset = "small" | "default" | "large" | "xlarge";
export const fontScaleValues: Record<FontScalePreset, number> = { small: 0.9, default: 1, large: 1.15, xlarge: 1.3 };
export const fontScaleLabels: Record<FontScalePreset, string> = { small: "Small", default: "Default", large: "Large", xlarge: "Extra large" };

const themeStorageKey = "noteschain.mobile.theme";
const fontScaleStorageKey = "noteschain.mobile.fontscale";
const ThemeContext = createContext<{
  colors: AppColors; mode: ThemeMode; resolvedMode: "light" | "dark"; setMode: (mode: ThemeMode) => void;
  fontScalePreset: FontScalePreset; fontScale: number; setFontScalePreset: (preset: FontScalePreset) => void;
} | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setStoredMode] = useState<ThemeMode>("system");
  const [fontScalePreset, setStoredFontScalePreset] = useState<FontScalePreset>("default");
  useEffect(() => {
    void SecureStore.getItemAsync(themeStorageKey).then((saved) => { if (saved === "system" || saved === "light" || saved === "dark") setStoredMode(saved); });
    void SecureStore.getItemAsync(fontScaleStorageKey).then((saved) => { if (saved === "small" || saved === "default" || saved === "large" || saved === "xlarge") setStoredFontScalePreset(saved); });
  }, []);
  const resolvedMode = mode === "system" ? systemMode : mode;
  const colors = resolvedMode === "dark" ? darkColors : lightColors;
  const fontScale = fontScaleValues[fontScalePreset];
  const setMode = (nextMode: ThemeMode) => { setStoredMode(nextMode); void SecureStore.setItemAsync(themeStorageKey, nextMode); };
  const setFontScalePreset = (preset: FontScalePreset) => { setStoredFontScalePreset(preset); void SecureStore.setItemAsync(fontScaleStorageKey, preset); };
  const value = useMemo(
    () => ({ colors, mode, resolvedMode, setMode, fontScalePreset, fontScale, setFontScalePreset }),
    [colors, mode, resolvedMode, fontScalePreset, fontScale],
  );
  // Android draws edge-to-edge from API 35 on, and targeting 36 makes it
  // non-negotiable: StatusBar's `backgroundColor` and `translucent` are
  // ignored there, so the bars are transparent and the window background is
  // what actually shows through behind them. Paint that instead; `barStyle`
  // still controls the icon colour, which is all it is used for now.
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.paper); }, [colors.paper]);
  return <ThemeContext.Provider value={value}><StatusBar barStyle={resolvedMode === "dark" ? "light-content" : "dark-content"} />{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
