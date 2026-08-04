import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { LIMITS } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { ByteCounter } from "@/components/draft/ByteCounter";
import { AutosaveIndicator, type AutosaveState } from "@/components/draft/AutosaveIndicator";
import { IdentityModeSelector } from "@/components/draft/IdentityModeSelector";
import { DiscoverabilitySelector } from "@/components/draft/DiscoverabilitySelector";
import { TagInput } from "@/components/draft/TagInput";
import { PublicationWarningDialog } from "@/components/draft/PublicationWarningDialog";
import { ApiClientError } from "@/lib/api";

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const hydrated = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

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

  function scheduleAutosave(nextTitle: string, nextContent: string) {
    if (!editable) return;
    setAutosaveState("unsaved");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (!navigator.onLine) {
        setAutosaveState("offline");
        return;
      }
      setAutosaveState("saving");
      autosave.mutate(
        { title: nextTitle, content: nextContent },
        {
          onSuccess: () => setAutosaveState("saved"),
          onError: () => setAutosaveState("error"),
        },
      );
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleAutosave(value, content);
  }
  function handleContentChange(value: string) {
    setContent(value);
    scheduleAutosave(title, value);
  }

  function persistMetadata(patch: Record<string, unknown>) {
    if (!editable) return;
    update.mutate(patch);
  }

  async function handleSubmit() {
    if (!id) return;
    try {
      await submit.mutateAsync(id);
      navigate("/drafts");
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Could not submit this draft.");
    }
  }

  async function handleConfirmPublish() {
    if (!id) return;
    const publication = await confirmPublish.mutateAsync(id);
    setWarningOpen(false);
    navigate(`/p/${(publication as { id: string }).id}`);
  }

  if (isLoading || !draft) {
    return <div className="px-4 py-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-2xl flex-col px-4 py-3 md:min-h-0 md:py-8">
      <div
        className="flex items-center justify-between border-b border-border pb-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/drafts")}
          className="flex items-center gap-1 text-sm text-muted-foreground"
          aria-label="Back to drafts"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <AutosaveIndicator state={isOnline ? autosaveState : "offline"} />
        {editable && (
          <button
            type="button"
            aria-label="Delete draft"
            onClick={async () => {
              if (!id) return;
              if (confirm("Delete this draft? This can't be undone.")) {
                await del.mutateAsync(id);
                navigate("/drafts");
              }
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={18} />
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
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        disabled={!editable}
        placeholder="Title"
        className="mt-4 w-full border-none bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-muted-foreground disabled:opacity-70"
      />
      <div className="mt-1 flex justify-end">
        <ByteCounter value={title} max={LIMITS.TITLE_MAX_BYTES} />
      </div>

      <Textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        disabled={!editable}
        placeholder="What's on your mind?"
        className="mt-2 min-h-[220px] flex-1 resize-none border-none bg-transparent p-0 text-body outline-none focus-visible:ring-0 disabled:opacity-70"
      />
      <div className="mt-1 flex justify-end">
        <ByteCounter value={content} max={LIMITS.BODY_MAX_BYTES} />
      </div>

      {editable && (
        <div className="mt-6 space-y-5 border-t border-border pt-6">
          <TagInput value={tags} onChange={(next) => { setTags(next); persistMetadata({ tags: next }); }} />
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
          <DiscoverabilitySelector
            value={discoverability}
            onChange={(next) => { setDiscoverability(next); persistMetadata({ discoverability: next }); }}
          />

          <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      )}

      {draft.status === "PENDING_REVIEW" && (
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            if (!id) return;
            await withdraw.mutateAsync(id);
          }}
          disabled={withdraw.isPending}
        >
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
          />
        </>
      )}
    </div>
  );
}
