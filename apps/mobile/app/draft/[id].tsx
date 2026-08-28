import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { Alert, AppState, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite, clearRecoveries, enqueue, preserveRecovery, recoveriesFor } from "@/src/lib/offline";
import type { Draft, Identity } from "@/src/lib/models";
import { Action, ErrorText, Field, Loading, Notice, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { BylinePicker } from "@/src/components/byline-picker";
import { PublishConfirmSheet } from "@/src/components/publish-confirm";
import { useTheme } from "@/src/lib/theme";
import { refreshDraftList, syncDraftInList } from "@/src/lib/drafts";

const editable = (status: string) => status === "DRAFT" || status === "CHANGES_REQUESTED";
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
  const [saveState, setSaveState] = useState("Saved");
  const [error, setError] = useState<string>();
  const latest = useRef({ title, content });
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    latest.current = { title, content };
  }, [title, content]);

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

  useEffect(() => {
    if (!id || !draft || !editable(draft.status)) return;
    const timer = setTimeout(() => { void autosave(); }, 1200);
    return () => clearTimeout(timer);
  }, [title, content]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if ((state === "background" || state === "inactive") && id && draft && editable(draft.status) && saveState !== "Saved") {
        preserveRecovery(id, latest.current);
      }
    });
    return () => sub.remove();
  }, [id, draft, saveState]);

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
      setSaveState("Saved on this device — sync queued");
      return;
    }
    try {
      setSaveState("Saving…");
      const saved = await api<Draft>(`/drafts/${id}/autosave`, { method: "POST", body: JSON.stringify(latest.current), idempotencyKey: saveKey() });
      cacheWrite(`draft:${id}`, saved);
      setDraft(saved);
      syncDraftInList(saved);
      setSaveState("Saved");
      clearRecoveries(id);
    } catch {
      setSaveState("Could not save — retrying when online");
    }
  };

  const updateMetadata = async () => {
    if (!id || !draft || !editable(draft.status)) return;
    try {
      const saved = await api<Draft>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(metadata()), idempotencyKey: saveKey() });
      cacheWrite(`draft:${id}`, saved);
      setDraft(saved);
      syncDraftInList(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update draft settings.");
    }
  };

  const selectByline = (identity: Identity) => {
    setIdentityMode(identity.isPrimary ? "NAMED" : "PSEUDONYMOUS");
    setIdentityId(identity.id);
  };

  const submit = async () => {
    if (!id) return;
    if (!title.trim() || !content.trim()) {
      setError("A title and body are required before submission.");
      return;
    }
    if (!identityId) {
      setError("Choose which byline to publish under.");
      return;
    }
    try {
      await autosave();
      await updateMetadata();
      const saved = await api<Draft>(`/drafts/${id}/submit`, { method: "POST", idempotencyKey: saveKey() });
      setDraft(saved);
      cacheWrite(`draft:${id}`, saved);
      syncDraftInList(saved);
      Alert.alert("Submitted", "Your note is now awaiting review.");
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

  if (draft === undefined) return <Loading label="Loading your draft…" />;
  if (!draft) return <Screen><ErrorText>This draft is unavailable. Connect once to load it on this device.</ErrorText></Screen>;
  const canEdit = editable(draft.status);

  return (
    <Screen>
      <Title>{canEdit ? "Edit draft" : "Your submission"}</Title>
      <Subtitle>{saveState}</Subtitle>

      {recoveryOffer && (
        <>
          <Notice>This device has newer edits than what's shown below — likely from before the app closed. Restore them?</Notice>
          <View style={styles.row}>
            <Action title="Restore" tone="secondary" onPress={restoreRecovery} />
            <Action title="Discard" tone="secondary" onPress={discardRecovery} />
          </View>
        </>
      )}
      {draft.status === "PENDING_REVIEW" && <Notice>Awaiting moderator review. You can withdraw it from the website for now.</Notice>}
      {draft.status === "APPROVED" && <Notice>Approved — you can now publish permanently while online.</Notice>}
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
          <Subtitle>{Array.from(content).length.toLocaleString()} characters</Subtitle>
          <Field placeholder="Tags, separated by commas" value={tags} onChangeText={setTags} onBlur={() => void updateMetadata()} />

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
          <Action title="Submit for review" icon={<Ionicons name="send-outline" size={18} color="#fff" />} onPress={() => void submit()} />
        </>
      )}

      {draft.status === "APPROVED" && (
        <Action title="Publish permanently" tone="danger" icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />} onPress={openPublishConfirm} />
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
