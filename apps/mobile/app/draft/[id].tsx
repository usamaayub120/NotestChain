import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { AppState, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { api } from "@/src/lib/api";
import { LIMITS, charactersOverLimit, characterLength, utf8ByteLength, validateTags } from "@/src/lib/limits";
import { cacheRead, cacheWrite, clearRecoveries, enqueue, preserveRecovery, recoveriesFor } from "@/src/lib/offline";
import type { Draft, Identity } from "@/src/lib/models";
import { Action, ErrorText, Field, Loading, Notice, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { BylinePicker } from "@/src/components/byline-picker";
import { PublishConfirmSheet } from "@/src/components/publish-confirm";
import { useTheme } from "@/src/lib/theme";
import { refreshDraftList, syncDraftInList } from "@/src/lib/drafts";

const editable = (status: string) => status === "DRAFT" || status === "CHANGES_REQUESTED";

/**
 * Ported from apps/web's AutosaveIndicator. The editor used to hold a free
 * string initialised to "Saved" that nothing set on keystroke, so for the
 * whole 1200ms debounce the screen said "Saved" while the typed text existed
 * only in memory -  and the backgrounding guard below keyed off that same
 * string, so it skipped preserving a recovery snapshot in exactly the window
 * where the text was least safe.
 */
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "saved-too-long" | "queued" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  "saved-too-long": "Saved - too long to submit",
  queued: "Saved on this device - sync queued",
  error: "Couldn't save",
};
const saveKey = () => `draft-save-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function DraftEditorScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [draft, setDraft] = useState<Draft | null>();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [identityMode, setIdentityMode] = useState<Draft["identityMode"]>("NAMED");
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [discoverability, setDiscoverability] = useState<Draft["discoverability"]>("PUBLIC");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // The words that have not been accepted by the server yet. The
  // backgrounding guard and the flush-on-leave below both key off this
  // rather than off the label, so neither can be fooled by what the
  // indicator happens to say.
  const pendingSave = useRef(false);
  const [error, setError] = useState<string>();
  const latest = useRef({ title, content });
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<{ title: string; content: string } | null>(null);
  // Publishing is online-only by design (see README). The button used to
  // fire regardless and fail into a generic network string, which is
  // indistinguishable from a transient failure on the one irreversible
  // action in the product.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    latest.current = { title, content };
  }, [title, content]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)));
    return () => unsubscribe();
  }, []);

  const offerRecoveryIfNewer = (draftId: string, loaded: { title: string; content: string; updatedAt: string }) => {
    const newest = recoveriesFor(draftId)[0];
    if (!newest || newest.createdAt <= new Date(loaded.updatedAt).getTime()) return;
    const body = newest.body as { title: string; content: string };
    if (body.title === loaded.title && body.content === loaded.content) return;
    setRecoveryOffer({ title: body.title, content: body.content });
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const remote = await api<Draft>(`/drafts/${id}`);
        cacheWrite(`draft:${id}`, remote);
        setDraft(remote);
        setTitle(remote.title);
        setContent(remote.content);
        setTags(remote.tags.join(", "));
        setIdentityMode(remote.identityMode);
        setIdentityId(remote.publicIdentityId);
        setDiscoverability(remote.discoverability);
        setIdentities(await api<Identity[]>("/identities"));
        offerRecoveryIfNewer(id, remote);
      } catch {
        const offline = cacheRead<Draft>(`draft:${id}`);
        setDraft(offline);
        if (offline) {
          setTitle(offline.title);
          setContent(offline.content);
          setTags(offline.tags.join(", "));
          setIdentityMode(offline.identityMode);
          setIdentityId(offline.publicIdentityId);
          setDiscoverability(offline.discoverability);
          offerRecoveryIfNewer(id, offline);
        }
      }
    })();
  }, [id]);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!id || !draft || !editable(draft.status)) return;
    // The first run of this effect is the load populating the fields, not a
    // keystroke; marking that "unsaved" would be a lie in the other
    // direction.
    if (!hydrated.current) { hydrated.current = true; return; }
    pendingSave.current = true;
    setSaveState("unsaved");
    const timer = setTimeout(() => { void autosave(); }, 1200);
    return () => clearTimeout(timer);
  }, [title, content]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if ((state === "background" || state === "inactive") && id && draft && editable(draft.status) && pendingSave.current) {
        preserveRecovery(id, latest.current);
      }
    });
    return () => sub.remove();
  }, [id, draft]);

  // Leaving the editor -  header back, the Android back button, a deep link -
  // used to drop whatever was inside the debounce window: the timer was
  // cleared on unmount and its payload was never sent. A snapshot here means
  // the words survive even if the request never goes out.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove" as never, () => {
      if (id && pendingSave.current) {
        preserveRecovery(id, latest.current);
        void autosave();
      }
    });
    return unsubscribe;
  }, [navigation, id]);

  const restoreRecovery = () => {
    if (!recoveryOffer) return;
    setTitle(recoveryOffer.title);
    setContent(recoveryOffer.content);
    setRecoveryOffer(null);
  };
  const discardRecovery = () => {
    if (id) clearRecoveries(id);
    setRecoveryOffer(null);
  };

  const metadata = () => ({
    tags: tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    identityMode,
    publicIdentityId: identityId,
    discoverability,
  });

  const autosave = async () => {
    if (!id || !draft || !editable(draft.status)) return;
    const online = (await NetInfo.fetch()).isConnected;
    if (!online) {
      preserveRecovery(id, latest.current);
      enqueue({ id: saveKey(), method: "POST", path: `/drafts/${id}/autosave`, body: latest.current, createdAt: Date.now() });
      const savedOnDevice = { ...draft, ...latest.current, updatedAt: new Date().toISOString() };
      cacheWrite(`draft:${id}`, savedOnDevice);
      syncDraftInList(savedOnDevice);
      setSaveState("queued");
      return;
    }
    // Measured off the payload being sent. An over-limit draft still saves -
    // losing someone's words for writing too many would be worse than the bug
    // being fixed -  but it must never report a plain "Saved", which is what
    // let a writer keep going all the way to Submit believing it was fine.
    const overLength = charactersOverLimit(latest.current.content, LIMITS.NOTE_BODY_MAX_CHARS) > 0;
    try {
      setSaveState("saving");
      const saved = await api<Draft>(`/drafts/${id}/autosave`, { method: "POST", body: JSON.stringify(latest.current), idempotencyKey: saveKey() });
      cacheWrite(`draft:${id}`, saved);
      setDraft(saved);
      syncDraftInList(saved);
      pendingSave.current = false;
      setSaveState(overLength ? "saved-too-long" : "saved");
      clearRecoveries(id);
    } catch {
      // Deliberately leaves pendingSave set, so the recovery snapshot and the
      // retry below still have the words to send.
      setSaveState("error");
    }
  };

  /** Returns false when the save failed, so callers can stop. */
  const updateMetadata = async (): Promise<boolean> => {
    if (!id || !draft || !editable(draft.status)) return true;
    try {
      const saved = await api<Draft>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(metadata()), idempotencyKey: saveKey() });
      cacheWrite(`draft:${id}`, saved);
      setDraft(saved);
      syncDraftInList(saved);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update draft settings.");
      return false;
    }
  };

  const selectByline = (identity: Identity) => {
    setIdentityMode(identity.isPrimary ? "NAMED" : "PSEUDONYMOUS");
    setIdentityId(identity.id);
  };

  const submit = async () => {
    if (!id) return;
    setError(undefined);
    if (!title.trim() || !content.trim()) {
      setError("A title and body are required before submission.");
      return;
    }
    if (!identityId) {
      setError("Choose which byline to publish under.");
      return;
    }
    // Checked here rather than left to the server, which answers with a raw
    // validation string that names neither the field nor the overage.
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    try {
      await autosave();
      // updateMetadata used to catch its own error and return normally, so a
      // rejected tag list let /submit fire anyway and the note reached
      // moderation without the tags, visibility or byline just chosen -  and
      // the error was then overwritten by a success alert.
      if (!(await updateMetadata())) return;
      const saved = await api<Draft>(`/drafts/${id}/submit`, { method: "POST", idempotencyKey: saveKey() });
      setDraft(saved);
      cacheWrite(`draft:${id}`, saved);
      syncDraftInList(saved);
      // Was a blocking Alert for a success, which interrupts to say nothing
      // actionable and leaves the writer on a now read-only editor. The
      // status banner below says the same thing without the tap.
      setSaveState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit this draft.");
    }
  };

  const openPublishConfirm = () => {
    setError(undefined);
    setConfirmingPublish(true);
  };
  const cancelPublishConfirm = () => {
    if (publishing) return;
    setConfirmingPublish(false);
    setError(undefined);
  };
  const confirmPublish = async () => {
    setPublishing(true);
    // The one irreversible action in the product had no physical
    // confirmation at all. A single notification-success tick on the way
    // out is the difference between "I pressed something" and "that
    // happened".
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    try {
      const publication = await api<{ id: string }>(`/drafts/${id}/confirm-publish`, {
        method: "POST",
        body: JSON.stringify({ acknowledgeIrreversible: true }),
        idempotencyKey: saveKey(),
      });
      refreshDraftList();
      setConfirmingPublish(false);
      router.replace(`/note/${publication.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish this note.");
    } finally {
      setPublishing(false);
    }
  };

  useLayoutEffect(() => {
    const fallback = draft && !editable(draft.status) ? "Your submission" : "Edit draft";
    navigation.setOptions({ title: title.trim() ? (title.length > 30 ? `${title.slice(0, 27)}…` : title) : fallback });
  }, [navigation, title, draft?.status]);

  const tagList = tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const titleBytes = utf8ByteLength(title);
  const bodyChars = characterLength(content);
  const bodyOver = charactersOverLimit(content, LIMITS.NOTE_BODY_MAX_CHARS);
  const tagProblem = validateTags(tagList);
  const blockedReason = titleBytes > LIMITS.TITLE_MAX_BYTES
    ? `The title is ${titleBytes - LIMITS.TITLE_MAX_BYTES} over the limit. Shorten it to submit.`
    : bodyOver > 0
      ? `This note is ${bodyOver.toLocaleString()} characters too long to submit. Remove ${bodyOver.toLocaleString()}.`
      : tagProblem?.message ?? null;

  if (draft === undefined) return <Loading label="Loading your draft…" />;
  if (!draft) return <Screen><ErrorText>This draft is unavailable. Connect once to load it on this device.</ErrorText></Screen>;
  const canEdit = editable(draft.status);

  return (
    <Screen>
      <Title>{canEdit ? "Edit draft" : "Your submission"}</Title>
      {saveState !== "idle" && (
        <Subtitle live>{SAVE_LABEL[saveState]}</Subtitle>
      )}

      {recoveryOffer && (
        <>
          <Notice>This device has newer edits than what's shown below - likely from before the app closed. Restore them?</Notice>
          <View style={styles.row}>
            <Action title="Restore" tone="secondary" onPress={restoreRecovery} />
            <Action title="Discard" tone="secondary" onPress={discardRecovery} />
          </View>
        </>
      )}
      {draft.status === "PENDING_REVIEW" && <Notice>Awaiting moderator review. You can withdraw it from the website for now.</Notice>}
      {draft.status === "APPROVED" && <Notice>Approved - you can now publish permanently while online.</Notice>}
      {draft.status === "REJECTED" && <Notice>This submission was rejected. Read any moderation feedback on the website.</Notice>}

      <Field editable={canEdit} placeholder="Title" value={title} onChangeText={setTitle} />
      <Field
        editable={canEdit}
        multiline
        placeholder="What's on your mind?"
        value={content}
        onChangeText={setContent}
        style={{ minHeight: 260, textAlignVertical: "top" }}
      />

      {canEdit && (
        <>
          <Subtitle>
            {bodyChars.toLocaleString()} / {LIMITS.NOTE_BODY_MAX_CHARS.toLocaleString()} characters
            {titleBytes > LIMITS.TITLE_MAX_BYTES * 0.8 ? ` · title ${titleBytes}/${LIMITS.TITLE_MAX_BYTES}` : ""}
          </Subtitle>
          <Field
            placeholder={`Tags, separated by commas (up to ${LIMITS.MAX_TAGS_PER_PUBLICATION})`}
            value={tags}
            onChangeText={setTags}
            onBlur={() => void updateMetadata()}
          />

          <Text style={{ color: colors.ink, fontWeight: "700" }}>Publish as</Text>
          <BylinePicker identities={identities} selectedId={identityId} onSelect={(identity) => { selectByline(identity); void updateMetadata(); }} />

          <Text style={{ color: colors.ink, fontWeight: "700" }}>Visibility</Text>
          <View style={styles.row}>
            <Action
              title="Public"
              tone={discoverability === "PUBLIC" ? "primary" : "secondary"}
              accessibilityRole="radio"
              accessibilityState={{ checked: discoverability === "PUBLIC" }}
              onPress={() => setDiscoverability("PUBLIC")}
            />
            <Action
              title="Unlisted"
              tone={discoverability === "UNLISTED" ? "primary" : "secondary"}
              accessibilityRole="radio"
              accessibilityState={{ checked: discoverability === "UNLISTED" }}
              onPress={() => setDiscoverability("UNLISTED")}
            />
          </View>

          <Action title="Save settings" tone="secondary" icon={<Ionicons name="save-outline" size={18} color={colors.ink} />} onPress={() => void updateMetadata()} />
          {blockedReason && <Notice>{blockedReason}</Notice>}
          <Action title="Submit for review" disabled={Boolean(blockedReason)} icon={<Ionicons name="send-outline" size={18} color={colors.onBrand} />} onPress={() => void submit()} />
        </>
      )}

      {draft.status === "APPROVED" && (
        <>
          {!online && <Notice>Publishing needs a connection. This one can't be undone, so it only happens online.</Notice>}
          <Action
            title="Publish permanently"
            tone="danger"
            disabled={!online}
            icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} />}
            onPress={openPublishConfirm}
          />
        </>
      )}
      {error && !confirmingPublish && <ErrorText>{error}</ErrorText>}

      <PublishConfirmSheet
        visible={confirmingPublish}
        publishing={publishing}
        error={confirmingPublish ? error : undefined}
        onCancel={cancelPublishConfirm}
        onConfirm={() => void confirmPublish()}
      />
    </Screen>
  );
}
