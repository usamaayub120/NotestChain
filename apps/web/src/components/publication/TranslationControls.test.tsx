import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TranslationControls } from "./TranslationControls";
afterEach(cleanup);
const base = { loading: false, showTranslation: false };
describe("reader translation controls", () => {
  it("offers all six languages and translates on selection", () => {
    const onTranslate = vi.fn();
    render(<TranslationControls state={base} authenticated onTranslate={onTranslate} onOriginal={vi.fn()} onSignIn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));
    for (const name of ["English", "Urdu", "Arabic", "Spanish", "French", "German"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Urdu" }));
    expect(onTranslate).toHaveBeenCalledWith("ur");
  });
  it("prompts guests to sign in without requesting a translation", () => {
    const onSignIn = vi.fn(), onTranslate = vi.fn();
    render(<TranslationControls state={base} authenticated={false} onTranslate={onTranslate} onOriginal={vi.fn()} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Translate" }));
    expect(screen.getByText("You'll return to this note after signing in.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledOnce(); expect(onTranslate).not.toHaveBeenCalled();
  });
  it("keeps original/change controls while loading and retries the selected language", () => {
    const onOriginal = vi.fn(), onTranslate = vi.fn();
    const state = { ...base, showTranslation: true, translation: { translatedTitle: "عنوان", translatedText: "متن", targetLang: "ur" as const, contentFormat: "PLAINTEXT" as const } };
    const view = render(<TranslationControls state={{ ...state, loading: true }} authenticated onTranslate={onTranslate} onOriginal={onOriginal} onSignIn={vi.fn()} />);
    expect(screen.getByText("Translated to Urdu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show original" })); expect(onOriginal).toHaveBeenCalledOnce();
    view.rerender(<TranslationControls state={{ ...state, error: "Quota reached", requestedLanguage: "de" }} authenticated onTranslate={onTranslate} onOriginal={onOriginal} onSignIn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(onTranslate).toHaveBeenCalledWith("de");
  });
});
