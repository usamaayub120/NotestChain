import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { StatusBar, useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export type AppColors = {
  ink: string; muted: string; border: string; paper: string; surface: string; elevated: string;
  brand: string; canopy: string; glow: string; danger: string; soft: string; success: string;
  notice: string; noticeBorder: string; noticeText: string; iconSoft: string; placeholder: string;
};

export const lightColors: AppColors = {
  ink: "#201e1b", muted: "#6f695d", border: "#ddd5c4", paper: "#f6f1e8", surface: "#ffffff", elevated: "#fbf8f2",
  // Meets WCAG AA against both the paper background and white button text.
  brand: "#b9422b", canopy: "#1f3327", glow: "#f0c48b", danger: "#c4361f", soft: "#ede7db", success: "#3f6b4c",
  notice: "#fff5de", noticeBorder: "#edd6a7", noticeText: "#765016", iconSoft: "#fce1d9", placeholder: "#78716c",
};

export const darkColors: AppColors = {
  ink: "#f5efe5", muted: "#c4bbae", border: "#514a40", paper: "#171513", surface: "#24211d", elevated: "#1d1a17",
  brand: "#ff7654", canopy: "#a9d4b2", glow: "#f0c48b", danger: "#ff806d", soft: "#35302a", success: "#8fc89c",
  notice: "#342b1b", noticeBorder: "#765b2c", noticeText: "#f5d68f", iconSoft: "#422a25", placeholder: "#aaa195",
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
  return <ThemeContext.Provider value={value}><StatusBar barStyle={resolvedMode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.paper} translucent={false} />{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
