import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { LIMITS, charactersOverLimit } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAutosaveDraft,
  useConfirmPublish,
  useDeleteDraft,
  useDraft,
  useSubmitDraft,
  useUpdateDraft,
  useWithdrawDraft,
} from "@/hooks/useDrafts";
import { useIdentities } from "@/hooks/useIdentities";
import { useDraftValidation } from "@/hooks/useDraftValidation";
import { ByteCounter } from "@/components/draft/ByteCounter";
import { NoteCounter } from "@/components/draft/NoteCounter";
import { FieldError } from "@/components/draft/FieldError";
import { FormatToolbar } from "@/components/draft/FormatToolbar";
import { EmojiPickerSheet } from "@/components/draft/EmojiPickerSheet";
import { AutosaveIndicator, type AutosaveState } from "@/components/draft/AutosaveIndicator";
import { IdentityModeSelector } from "@/components/draft/IdentityModeSelector";
import { DiscoverabilitySelector } from "@/components/draft/DiscoverabilitySelector";
import { TagInput } from "@/components/draft/TagInput";
import { PublicationWarningDialog } from "@/components/draft/PublicationWarningDialog";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { NoteContent } from "@/components/note/NoteContent";
import { toggleWrap } from "@/lib/textSelection";
import { asZodFlatten, firstFieldMessage } from "@/lib/formErrors";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/Loader";

const AUTOSAVE_DEBOUNCE_MS = 1200;

export function DraftEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading } = useDraft(id);
  const { data: identities = [] } = useIdentities();
  const autosave = useAutosaveDraft(id!);
  const update = useUpdateDraft(id!);
  const submit = useSubmitDraft();
  const withdraw = useWithdrawDraft();
  const del = useDeleteDraft();
  const confirmPublish = useConfirmPublish();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [identityMode, setIdentityMode] = useState<"NAMED" | "PSEUDONYMOUS" | "ANONYMOUS">("NAMED");
  const [publicIdentityId, setPublicIdentityId] = useState<string | null>(null);
  const [discoverability, setDiscoverability] = useState<"PUBLIC" | "UNLISTED">("PUBLIC");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [warningOpen, setWarningOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Errors the SERVER reported, as opposed to the live client-side ones.
  const [serverErrors, setServerErrors] = useState<{ title?: string; content?: string; form?: string }>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const hydrated = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const validation = useDraftValidation({ title, content, identityMode, publicIdentityId });

  useEffect(() => {
    if (draft && !hydrated.current) {
      setTitle(draft.title);
      setContent(draft.content);
      setTags(draft.tags);
      setIdentityMode(draft.identityMode);
      setPublicIdentityId(draft.publicIdentityId);
      setDiscoverability(draft.discoverability);
      hydrated.current = true;
    }
  }, [draft]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const editable = draft ? ["DRAFT", "CHANGES_REQUESTED"].includes(draft.status) : false;
  const format = draft?.contentFormat ?? "PLAINTEXT";

  function scheduleAutosave(nextTitle: string, nextContent: string) {
    if (!editable) return;
    setAutosaveState("unsaved");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Derived from nextContent rather than read off `validation`. The
    // memoized validation belongs to the render this closure was created in,
    // which is the one BEFORE setContent applied — so reading it here reports
    // the previous keystroke's length and the indicator lags a character
    // behind. Exactly the kind of "it says it's fine" staleness this whole
    // change exists to remove.
    const willBeOverLength = charactersOverLimit(nextContent, LIMITS.NOTE_BODY_MAX_CHARS) > 0;

    debounceTimer.current = setTimeout(() => {
      if (!navigator.onLine) {
        setAutosaveState("offline");
        return;
      }
      setAutosaveState("saving");
      autosave.mutate(
        { title: nextTitle, content: nextContent },
        {
          // An over-limit draft still saves. What it must not do is report
          // plain "Saved", which is what let a writer keep going all the way
          // to Submit believing everything was fine.
          onSuccess: () => setAutosaveState(willBeOverLength ? "saved-too-long" : "saved"),
          onError: () => setAutosaveState("error"),
        },
      );
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setServerErrors((prev) => ({ ...prev, title: undefined }));
    scheduleAutosave(value, content);
  }
  function handleContentChange(value: string) {
    setContent(value);
    setServerErrors((prev) => ({ ...prev, content: undefined }));
    scheduleAutosave(title, value);
  }

  function persistMetadata(patch: Record<string, unknown>) {
    if (!editable) return;
    update.mutate(patch);
  }

  /** Cmd/Ctrl+B and +I, plus Cmd/Ctrl+Shift+H for highlight. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Never fight an in-progress IME composition — intercepting keys mid
    // composition drops characters for anyone typing Japanese or Korean.
    if (event.nativeEvent.isComposing || event.repeat) return;
    const mod = event.metaKey || event.ctrlKey;
    if (!mod || event.altKey) return;
    const el = contentRef.current;
    if (!el) return;

    // e.key, not e.code, so the shortcut follows the user's keyboard layout.
    const key = event.key.toLowerCase();
    if (event.shiftKey && key === "h") {
      event.preventDefault();
      toggleWrap(el, "==");
    } else if (!event.shiftKey && key === "b") {
      event.preventDefault();
      toggleWrap(el, "**");
    } else if (!event.shiftKey && key === "i") {
      event.preventDefault();
      toggleWrap(el, "*");
    }
  }

  async function handleSubmit() {
    if (!id) return;
    setSubmitAttempted(true);

    // Submit uses aria-disabled rather than `disabled`, so it stays focusable
    // and clickable. A truly disabled button is a dead end: a keyboard or
    // screen-reader user tabs past it and never learns why — which is the
    // original complaint in a quieter form. Pressing it names the problem and
    // puts the cursor on it.
    if (!validation.isValid) {
      if (validation.firstInvalidField === "title") titleRef.current?.focus();
      else if (validation.firstInvalidField === "content") contentRef.current?.focus();
      return;
    }

    setServerErrors({});
    try {
      await submit.mutateAsync(id);
      navigate("/drafts");
    } catch (err) {
      if (err instanceof ApiClientError) {
        // The server has always sent a zod flatten naming the offending
        // field in `details`; the old editor discarded it and showed the
        // generic message in an alert().
        const flat = asZodFlatten(err.details);
        const titleError = firstFieldMessage(flat, "title");
        const contentError = firstFieldMessage(flat, "content");
        setServerErrors({
          title: titleError,
          content: contentError,
          form: titleError || contentError ? undefined : (flat?.formErrors[0] ?? err.message),
        });
        if (titleError) titleRef.current?.focus();
        else if (contentError) contentRef.current?.focus();
      } else {
        setServerErrors({ form: "Could not submit this draft." });
      }
    }
  }

  async function handleConfirmPublish() {
    if (!id) return;
    setPublishError(null);
    try {
      const publication = await confirmPublish.mutateAsync(id);
      setWarningOpen(false);
      navigate(`/p/${(publication as { id: string }).id}`);
    } catch (err) {
      // Keep the dialog open and show why. Previously this rejected into the
      // void: setWarningOpen(false) never ran, so the dialog just sat there.
      setPublishError(err instanceof ApiClientError ? err.message : "Could not publish this note.");
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await del.mutateAsync(id);
      navigate("/drafts");
    } catch (err) {
      setDeleteOpen(false);
      setServerErrors({ form: err instanceof ApiClientError ? err.message : "Could not delete this draft." });
    }
  }

  async function handleWithdraw() {
    if (!id) return;
    try {
      await withdraw.mutateAsync(id);
    } catch (err) {
      setServerErrors({ form: err instanceof ApiClientError ? err.message : "Could not withdraw this submission." });
    }
  }

  if (isLoading || !draft) {
    return <PageLoader label="Loading your draft" />;
  }

  const titleError = serverErrors.title ?? (submitAttempted ? validation.fieldErrors.title : undefined);
  const contentError = serverErrors.content ?? validation.fieldErrors.content;

  return (
    // max-w-reading (72ch), per DESIGN_SYSTEM.md §10 — the previous
    // max-w-2xl worked out to roughly 79ch at text-body.
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-reading flex-col px-4 py-3 md:min-h-0 md:py-8">
      <div
        className="flex items-center justify-between gap-2 border-b border-border pb-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/drafts")}
          className="flex min-h-11 min-w-11 items-center gap-1 text-sm text-muted-foreground"
          aria-label="Back to drafts"
        >
          <ArrowLeft size={20} strokeWidth={1.75} /> Back
        </button>
        <AutosaveIndicator state={isOnline ? autosaveState : "offline"} />
        {editable && (
          <button
            type="button"
            aria-label="Delete draft"
            onClick={() => setDeleteOpen(true)}
            className="flex size-11 items-center justify-center text-muted-foreground md:hover:text-destructive"
          >
            <Trash2 size={20} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {!editable && (
        <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
          {draft.status === "PENDING_REVIEW" && "Awaiting moderator review — you can withdraw it below."}
          {draft.status === "APPROVED" && "Approved! Publish it permanently when you're ready."}
          {draft.status === "REJECTED" && "This submission was rejected."}
          {draft.status === "ARCHIVED" && "This draft is archived."}
        </div>
      )}

      <input
        ref={titleRef}
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        disabled={!editable}
        placeholder="Title"
        aria-label="Title"
        aria-invalid={Boolean(titleError)}
        aria-describedby="title-counter title-error"
        className={cn(
          "mt-4 w-full border-none bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-muted-foreground disabled:opacity-70",
          titleError && "text-destructive",
        )}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <FieldError id="title-error" message={titleError} />
        <ByteCounter id="title-counter" value={title} max={LIMITS.TITLE_MAX_BYTES} />
      </div>

      {editable ? (
        <Tabs defaultValue="write" className="mt-3 flex flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="flex flex-1 flex-col">
            <FormatToolbar textareaRef={contentRef}>
              <EmojiPickerSheet textareaRef={contentRef} />
            </FormatToolbar>
            <Textarea
              ref={contentRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind?"
              aria-label="Note body"
              aria-invalid={Boolean(contentError)}
              aria-describedby="content-counter content-error"
              // No maxLength, deliberately. It would silently swallow
              // keystrokes mid-thought, and it counts UTF-16 units rather
              // than characters, so it would be numerically wrong anyway.
              className="mt-2 min-h-[220px] flex-1 resize-none border-none bg-transparent p-0 text-body outline-none focus-visible:ring-0"
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1">
            <NoteContent
              source={content}
              format="MARKDOWN"
              shimmer
              className="mt-2 text-body leading-relaxed"
            />
            {!content.trim() && <p className="mt-2 text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </TabsContent>
        </Tabs>
      ) : (
        <NoteContent source={content} format={format} shimmer className="mt-4 flex-1 text-body leading-relaxed" />
      )}

      {editable && (
        <div className="mt-1 flex flex-col gap-1">
          <NoteCounter id="content-counter" value={content} />
          <FieldError id="content-error" message={contentError} />
        </div>
      )}

      {editable && (
        <div className="mt-6 space-y-5 border-t border-border pt-6">
          <TagInput value={tags} onChange={(next) => { setTags(next); persistMetadata({ tags: next }); }} />
          <div>
            <IdentityModeSelector
              value={identityMode}
              identities={identities}
              publicIdentityId={publicIdentityId}
              onChange={(mode, pid) => {
                setIdentityMode(mode);
                setPublicIdentityId(pid);
                persistMetadata({ identityMode: mode, publicIdentityId: pid });
              }}
            />
            {submitAttempted && <FieldError message={validation.fieldErrors.publicIdentityId} />}
          </div>
          <DiscoverabilitySelector
            value={discoverability}
            onChange={(next) => { setDiscoverability(next); persistMetadata({ discoverability: next }); }}
          />

          {serverErrors.form && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverErrors.form}
            </p>
          )}

          {!validation.isValid && (
            <p id="submit-blocked" role="status" className="text-sm text-muted-foreground">
              {validation.blockedReason}
            </p>
          )}

          <Button
            className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            size="lg"
            onClick={handleSubmit}
            aria-disabled={!validation.isValid || submit.isPending}
            aria-describedby={validation.isValid ? undefined : "submit-blocked"}
          >
            {submit.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      )}

      {draft.status === "PENDING_REVIEW" && (
        <Button variant="outline" className="mt-6" onClick={handleWithdraw} disabled={withdraw.isPending}>
          Withdraw submission
        </Button>
      )}

      {draft.status === "APPROVED" && (
        <>
          <Button className="mt-6" size="lg" onClick={() => setWarningOpen(true)}>
            Publish permanently
          </Button>
          <PublicationWarningDialog
            open={warningOpen}
            onOpenChange={setWarningOpen}
            onConfirm={handleConfirmPublish}
            isPending={confirmPublish.isPending}
            error={publishError}
          />
        </>
      )}

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this draft?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={del.isPending}
      />
    </div>
  );
}
