import { render, fireEvent } from "@testing-library/react-native";
import { TranslationControls } from "./translation-controls";
jest.mock("expo-router", () => ({ usePathname: () => "/note/test" }));
jest.mock("@/src/lib/theme", () => ({ useTheme: () => ({ colors: { ink: "black", muted: "gray", surface: "white", brand: "blue", border: "gray" } }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
const base = { loading: false, showTranslation: false };
describe("native translation controls", () => {
  it("selects a language from the native sheet", async () => {
    const onTranslate = jest.fn();
    const view = await render(<TranslationControls state={base} authenticated onTranslate={onTranslate} onOriginal={jest.fn()} onSignIn={jest.fn()} />);
    await fireEvent.press(view.getByText("Translate"));
    await fireEvent.press(view.getByText("Arabic"));
    expect(onTranslate).toHaveBeenCalledWith("ar");
  });
  it("keeps guests on the note until they choose sign-in", async () => {
    const onSignIn = jest.fn(), onTranslate = jest.fn();
    const view = await render(<TranslationControls state={base} authenticated={false} onTranslate={onTranslate} onOriginal={jest.fn()} onSignIn={onSignIn} />);
    await fireEvent.press(view.getByText("Translate"));
    expect(view.getByText("You'll return to this note after signing in.")).toBeTruthy();
    await fireEvent.press(view.getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalledTimes(1); expect(onTranslate).not.toHaveBeenCalled();
  });
  it("restores the original and retries failed language requests", async () => {
    const onOriginal = jest.fn(), onTranslate = jest.fn();
    const view = await render(<TranslationControls state={{ ...base, showTranslation: true, translation: { translatedTitle: "عنوان", translatedText: "متن", targetLang: "ur", contentFormat: "PLAINTEXT" }, error: "Unavailable", requestedLanguage: "fr" }} authenticated onTranslate={onTranslate} onOriginal={onOriginal} onSignIn={jest.fn()} />);
    expect(view.getByText("Translated to Urdu")).toBeTruthy();
    await fireEvent.press(view.getByText("Show original")); expect(onOriginal).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText("Try again")); expect(onTranslate).toHaveBeenCalledWith("fr");
  });
});
