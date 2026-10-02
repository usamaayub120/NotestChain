import { Languages } from "lucide-react";
import { NOTE_LANGUAGES, noteLanguage, type NoteLanguage, type TranslationState } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export function TranslationControls({ state, authenticated, onTranslate, onOriginal, onSignIn }: { state: TranslationState; authenticated: boolean; onTranslate: (language: NoteLanguage) => void; onOriginal: () => void; onSignIn: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const open = () => { if (authenticated) setChoosing(true); else setSignIn(true); };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" onClick={open} disabled={state.loading}><Languages size={18} aria-hidden />{state.loading ? "Translating…" : state.showTranslation ? "Change language" : "Translate"}</Button>
      {state.showTranslation && state.translation && <><p className="text-sm text-muted-foreground">Translated to {noteLanguage(state.translation.targetLang).label}</p><Button type="button" variant="ghost" onClick={onOriginal}>Show original</Button></>}
    </div>
    <p role="status" className="sr-only">{state.loading ? "Translating this note" : state.showTranslation ? "Translation ready" : "Showing the original note"}</p>
    {state.error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{state.error}</p><Button type="button" variant="outline" onClick={() => { if (state.signInRequired) onSignIn(); else if (state.requestedLanguage) onTranslate(state.requestedLanguage); }}>{state.signInRequired ? "Sign in" : "Try again"}</Button></div>}
    <Dialog open={choosing} onOpenChange={setChoosing}><DialogContent><DialogHeader><DialogTitle>Translate this note</DialogTitle><DialogDescription>Choose a language for the title and text. The original note stays unchanged.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{NOTE_LANGUAGES.map((language) => <Button type="button" key={language.code} variant={state.translation?.targetLang === language.code ? "secondary" : "outline"} onClick={() => { setChoosing(false); onTranslate(language.code); }}>{language.label}</Button>)}</div></DialogContent></Dialog>
    <Dialog open={signIn} onOpenChange={setSignIn}><DialogContent><DialogHeader><DialogTitle>Sign in to translate</DialogTitle><DialogDescription>You'll return to this note after signing in.</DialogDescription></DialogHeader><Button onClick={onSignIn}>Sign in</Button><Button variant="ghost" onClick={() => setSignIn(false)}>Keep reading</Button></DialogContent></Dialog>
  </div>;
}
