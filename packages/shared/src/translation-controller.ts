import type { NoteLanguage, NoteTranslation } from "./languages.js";

export type TranslationState = { loading: boolean; translation?: NoteTranslation; showTranslation: boolean; error?: string; signInRequired?: boolean; requestedLanguage?: NoteLanguage };
/** Client state scoped to one publication. An aborted or superseded request cannot replace it. */
export class TranslationController {
  private generation = 0;
  private abort?: AbortController;
  private state: TranslationState = { loading: false, showTranslation: false };
  private cache = new Map<NoteLanguage, NoteTranslation>();
  private listeners = new Set<() => void>();
  constructor(private fetcher: (language: NoteLanguage, signal: AbortSignal) => Promise<NoteTranslation>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: TranslationState) { this.state = next; this.listeners.forEach((listener) => listener()); }
  async translate(language: NoteLanguage) {
    this.abort?.abort();
    const generation = ++this.generation;
    const cached = this.cache.get(language);
    if (cached) { this.update({ loading: false, showTranslation: true, translation: cached, requestedLanguage: language }); return; }
    const abort = new AbortController(); this.abort = abort;
    this.update({ ...this.state, loading: true, error: undefined, signInRequired: false, requestedLanguage: language });
    try {
      const translation = await this.fetcher(language, abort.signal);
      if (generation !== this.generation) return;
      this.cache.set(language, translation);
      this.update({ loading: false, showTranslation: true, translation, requestedLanguage: language });
    } catch (error) {
      if (generation !== this.generation || abort.signal.aborted) return;
      const auth = typeof error === "object" && error !== null && "status" in error && error.status === 401;
      this.update({ ...this.state, loading: false, signInRequired: auth, error: auth ? "Sign in to translate this note." : error instanceof Error ? error.message : "Translation couldn't finish. Please try again." });
    }
  }
  original = () => { this.cancel(); this.update({ ...this.state, loading: false, showTranslation: false, error: undefined, signInRequired: false }); };
  cancel = () => { ++this.generation; this.abort?.abort(); this.abort = undefined; };
}
