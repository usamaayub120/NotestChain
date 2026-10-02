import { forwardRef, useEffect, useImperativeHandle, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { defaultNoteLanguage, DICTATION_DISCLOSURE, NOTE_LANGUAGES, noteLanguage, type NoteLanguage } from "@noteschain/shared";
import { BrowserDictation, browserRecognizer } from "@/lib/dictation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DictationHandle = { cancel: () => void };
const LANGUAGE_KEY = "noteschain.dictation.language";
const CONSENT_KEY = "noteschain.dictation.disclosure.v1";
function storedLanguage() { try { const stored = localStorage.getItem(LANGUAGE_KEY); return stored ? noteLanguage(stored).code : defaultNoteLanguage(navigator.language); } catch { return defaultNoteLanguage(navigator.language); } }

export const DictationControl = forwardRef<DictationHandle, { enabled: boolean; onFinal: (text: string) => void }>(function DictationControl({ enabled, onFinal }, ref) {
  const [controller] = useState(() => new BrowserDictation(browserRecognizer()));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [language, setLanguage] = useState<NoteLanguage>(storedLanguage);
  const [disclosure, setDisclosure] = useState(false);
  const active = state.phase !== "idle";
  useImperativeHandle(ref, () => ({ cancel: controller.cancel }), [controller]);
  useEffect(() => { controller.onFinal = onFinal; }, [controller, onFinal]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) controller.cancel(); };
    window.addEventListener("pagehide", controller.cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("pagehide", controller.cancel); document.removeEventListener("visibilitychange", hidden); controller.cancel(); };
  }, [controller, enabled]);
  const start = () => {
    if (!enabled) return;
    let consented = false;
    try { consented = localStorage.getItem(CONSENT_KEY) === "yes"; } catch { /* Show disclosure when storage is unavailable. */ }
    if (!consented) { setDisclosure(true); return; }
    controller.start(noteLanguage(language).locale);
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="dictation-language">Dictation language</label>
      <select id="dictation-language" aria-label="Dictation language" value={language} disabled={!enabled || active} onChange={(event) => { const next = noteLanguage(event.target.value).code; setLanguage(next); try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Session preference still works. */ } }} className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {NOTE_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
      <Button type="button" variant="ghost" disabled={!enabled || state.phase === "stopping"} onMouseDown={(event) => event.preventDefault()} onClick={active ? controller.stop : start}>
        {active ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
        {state.phase === "starting" ? "Starting…" : state.phase === "stopping" ? "Stopping…" : active ? "Stop dictation" : "Dictate"}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">{state.phase === "listening" ? "Listening" : ""}</span>
    </div>
    {state.interim && <p className="text-sm text-muted-foreground" dir="auto">{state.interim}</p>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {!controller.supported && <p className="text-sm text-muted-foreground">This browser doesn't support dictation. You can continue typing.</p>}
    <Dialog open={disclosure} onOpenChange={setDisclosure}><DialogContent><DialogHeader><DialogTitle>Write with your voice</DialogTitle><DialogDescription>{DICTATION_DISCLOSURE}</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={() => setDisclosure(false)}>Cancel</Button><Button onClick={() => { setDisclosure(false); try { localStorage.setItem(CONSENT_KEY, "yes"); } catch { /* Consent remains for this start. */ } if (enabled) controller.start(noteLanguage(language).locale); }}>Start dictation</Button></DialogFooter></DialogContent></Dialog>
  </div>;
});
