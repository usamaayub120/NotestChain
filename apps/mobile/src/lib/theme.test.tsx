import type { PropsWithChildren } from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { ThemeProvider, useTheme, lightColors, darkColors } from "./theme";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;

const wrapper = ({ children }: PropsWithChildren) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetItem.mockResolvedValue(null);
  // useColorScheme reads Appearance.getColorScheme() on mount — spying here
  // controls it without re-mocking the whole react-native module (which
  // would bypass jest-expo's own native-module shims).
  jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");
});

describe("useTheme", () => {
  it("throws when used outside a ThemeProvider", () => {
    // React logs the thrown render error to console.error even though the
    // test catches it below — silence just that expected noise.
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/useTheme must be used within ThemeProvider/);
    consoleError.mockRestore();
  });

  it("defaults to system mode, resolved via the device color scheme", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(mockedGetItem).toHaveBeenCalled());
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
    expect(result.current.colors).toEqual(lightColors);
  });

  it("restores a persisted mode from SecureStore, overriding the system scheme", async () => {
    mockedGetItem.mockResolvedValue("dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe("dark"));
    expect(result.current.resolvedMode).toBe("dark");
    expect(result.current.colors).toEqual(darkColors);
  });

  it("falls back to system mode when the persisted value is invalid", async () => {
    mockedGetItem.mockResolvedValue("neon");
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(mockedGetItem).toHaveBeenCalled());
    expect(result.current.mode).toBe("system");
    expect(result.current.colors).toEqual(lightColors);
  });

  it("setMode updates resolvedMode and persists the choice", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(mockedGetItem).toHaveBeenCalled());
    act(() => { result.current.setMode("dark"); });
    await waitFor(() => expect(result.current.mode).toBe("dark"));
    expect(result.current.resolvedMode).toBe("dark");
    expect(mockedSetItem).toHaveBeenCalledWith(expect.stringContaining("theme"), "dark");
  });

  it("defaults to the 'default' font scale (1x)", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(mockedGetItem).toHaveBeenCalled());
    expect(result.current.fontScalePreset).toBe("default");
    expect(result.current.fontScale).toBe(1);
  });

  it("restores a persisted font scale preset from SecureStore", async () => {
    mockedGetItem.mockImplementation((key: string) => Promise.resolve(key.includes("fontscale") ? "large" : null));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.fontScalePreset).toBe("large"));
    expect(result.current.fontScale).toBeCloseTo(1.15);
  });

  it("setFontScalePreset updates fontScale and persists the choice", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(mockedGetItem).toHaveBeenCalled());
    act(() => { result.current.setFontScalePreset("xlarge"); });
    await waitFor(() => expect(result.current.fontScalePreset).toBe("xlarge"));
    expect(result.current.fontScale).toBeCloseTo(1.3);
    expect(mockedSetItem).toHaveBeenCalledWith(expect.stringContaining("fontscale"), "xlarge");
  });
});
