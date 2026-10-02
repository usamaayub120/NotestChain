import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, Link, useNavigation, router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { api, apiPage, getToken } from "@/src/lib/api";
import { cacheRead, cacheWrite, enqueue } from "@/src/lib/offline";
import type { Comment, Identity, Page, Publication } from "@/src/lib/models";
import { Action, Card, Divider, ErrorText, Field, IconButton, Loading, Notice, Screen, Subtitle, styles } from "@/src/components/ui";
import { CaptchaSheet } from "@/src/components/captcha-sheet";
import { ReportDialog } from "@/src/components/report-dialog";
import { ProofSheet } from "@/src/components/proof-sheet";
import { NoteContent } from "@/src/components/note-content";
import { BylinePicker } from "@/src/components/byline-picker";
import { FollowButton } from "@/src/components/follow-button";
import { useTheme } from "@/src/lib/theme";
import { DRAFT_STATUS_LABELS, formatNoteDate, identityKindLabel } from "@/src/lib/labels";
import { KeptStamp } from "@/src/components/kept-stamp";
import { shareNote } from "@/src/lib/share";
import { fonts } from "@/src/lib/fonts";
import { TranslationController, noteLanguage, type NoteTranslation } from "@noteschain/shared";
import { TranslationControls } from "@/src/components/translation-controls";

const mutationId = () => `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const chainPendingCopy = (status: string) =>
  status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT"
    ? "We hit a snag writing this note to the blockchain. We'll keep retrying - check back soon."
    : "Writing this note to the blockchain - this can take a few minutes. Its verification link will appear here once it's confirmed.";

export default function NoteScreen() {
  const navigation = useNavigation();
  const { colors, fontScale } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["note", id],
    enabled: Boolean(id),
    queryFn: async () => {
      try {
        const note = await api<Publication>(`/publications/${id}`);
        cacheWrite(`note:${id}`, note);
        void api(`/publications/${id}/view`, { method: "POST", body: JSON.stringify({}), visitor: true });
        return note;
      } catch {
        return cacheRead<Publication>(`note:${id}`);
      }
    },
  });

  const comments = useQuery({
    queryKey: ["comments", id],
    enabled: Boolean(id),
    queryFn: async () => {
      try {
        const page = await apiPage<Comment>(`/publications/${id}/comments?page=1&pageSize=30`);
        cacheWrite(`comments:${id}`, page);
        return page;
      } catch {
        return cacheRead<Page<Comment>>(`comments:${id}`) ?? { data: [], meta: { page: 1, pageSize: 30, total: 0 } };
      }
    },
  });

  const [bookmarked, setBookmarked] = useState(false);
  const [body, setBody] = useState("");
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [commentIdentityId, setCommentIdentityId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const [authenticated, setAuthenticated] = useState(false);
  useFocusEffect(useCallback(() => { let mounted = true; void getToken().then((token) => { if (mounted) setAuthenticated(Boolean(token)); }).catch(() => {}); return () => { mounted = false; }; }, []));
  const translationController = useMemo(() => new TranslationController((targetLang, signal) => api<NoteTranslation>(`/publications/${id}/translation`, { method: "POST", body: JSON.stringify({ targetLang }), signal, timeoutMs: 20000, returnNote: id })), [id]);
  const translationState = useSyncExternalStore(translationController.subscribe, translationController.getSnapshot);
  const translated = translationState.showTranslation ? translationState.translation : undefined;
  useEffect(() => () => translationController.cancel(), [translationController]);
  useFocusEffect(useCallback(() => () => translationController.original(), [translationController]));

  // Opens §13's proof sheet in the app. This used to call Linking.openURL
  // and drop the reader into Solana Explorer, so the signature, PDA and slot
  // were never shown in the product at all. The explorer link lives inside
  // the sheet now, for anyone who does want to leave.
  //
  // Declared here with the other hooks, not beside the sheet it opens: the
  // two early returns below run on the first render, so a useState after
  // them changes the hook count once the note loads and React throws
  // "Rendered more hooks than during the previous render."
  const [proofOpen, setProofOpen] = useState(false);

  useEffect(() => {
    api<{ publication: { id: string } }[]>("/bookmarks")
      .then((rows) => setBookmarked(rows.some((row) => row.publication.id === id)))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    api<Identity[]>("/identities")
      .then((rows) => {
        setIdentities(rows);
        const primary = rows.find((identity) => identity.isPrimary);
        if (primary) setCommentIdentityId((current) => current ?? primary.id);
      })
      .catch(() => undefined);
  }, []);

  useLayoutEffect(() => {
    const title = query.data?.title;
    if (title) navigation.setOptions({ title: title.length > 36 ? `${title.slice(0, 33)}…` : title });
  }, [navigation, query.data?.title]);

  if (query.isLoading || !comments.data) return <Loading label="Loading note…" />;
  if (!query.data) return <Screen><ErrorText>This note is unavailable offline.</ErrorText></Screen>;
  const note = query.data;

  const reversible = async (path: string, method: string, payload: unknown) => {
    const online = (await NetInfo.fetch()).isConnected;
    if (!online) {
      enqueue({ id: mutationId(), method, path, body: payload, createdAt: Date.now() });
      setNotice("Saved on this device - it will sync when you reconnect.");
      return;
    }
    await api(path, { method, body: JSON.stringify(payload), idempotencyKey: mutationId() });
  };

  const toggleBookmark = async () => {
    try {
      if (bookmarked) await reversible(`/bookmarks/${id}`, "DELETE", {});
      else await reversible("/bookmarks", "POST", { publicationId: id });
      setBookmarked(!bookmarked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update bookmark.");
    }
  };

  const share = async () => {
    try {
      await shareNote(note.title, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share this note.");
    }
  };

  const postComment = async (captchaToken?: string) => {
    if (!body.trim()) return;
    if (!commentIdentityId) {
      setError("Choose which byline to comment under.");
      return;
    }
    if (!captchaToken) {
      setNotice("Complete the quick verification here in the app to post your comment.");
      setCaptchaOpen(true);
      return;
    }
    try {
      await reversible(`/publications/${id}/comments`, "POST", {
        body,
        publicIdentityId: commentIdentityId,
        captchaToken,
      });
      setBody("");
      setNotice("Comment submitted.");
      await comments.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post comment.");
    }
  };

  const report = async (reason: string) => {
    setReporting(true);
    setReportError(undefined);
    try {
      await reversible(`/publications/${id}/report`, "POST", { reason });
      setReportOpen(false);
      setNotice("Thanks. Your report has been submitted.");
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Could not submit report.");
    } finally {
      setReporting(false);
    }
  };

  return (
    <Screen fitContent>
      <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 29 * fontScale, lineHeight: 36 * fontScale, writingDirection: translated ? noteLanguage(translated.targetLang).rtl ? "rtl" : "ltr" : "auto" }}>
        {translated?.translatedTitle ?? note.title}
      </Text>

      {note.author ? (
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Link href={`/profile/${note.author.username}`} style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 16 * fontScale }}>{note.author.displayName}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
              {"\n"}@{note.author.username} · {identityKindLabel(note.author.isPrimary)}
            </Text>
          </Link>
          <FollowButton username={note.author.username} />
        </View>
      ) : (
        <Subtitle>Anonymous</Subtitle>
      )}
      <Subtitle>{note.publishedAt ? formatNoteDate(note.publishedAt) : DRAFT_STATUS_LABELS.CHAIN_PENDING}</Subtitle>

      <TranslationControls key={id} state={translationState} authenticated={authenticated} onTranslate={(language) => void translationController.translate(language)} onOriginal={translationController.original} onSignIn={() => router.push({ pathname: "/account", params: { returnNote: id } })} />
      <NoteContent source={translated?.translatedText ?? note.content} format={translated ? "PLAINTEXT" : note.contentFormat} fontScale={fontScale} direction={translated ? noteLanguage(translated.targetLang).rtl ? "rtl" : "ltr" : "auto"} />

      {note.tags.map((tag) => (
        <Text key={tag} style={{ color: colors.muted, fontSize: 14 * fontScale }}>#{tag}</Text>
      ))}

      <View style={styles.row}>
        <IconButton
          accessibilityRole="switch"
          accessibilityState={{ checked: bookmarked }}
          accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark this note"}
          icon={<Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={22} color={colors.ink} />}
          onPress={() => void toggleBookmark()}
        />
        <IconButton
          accessibilityLabel="Share this note"
          icon={<Ionicons name="share-outline" size={22} color={colors.ink} />}
          onPress={() => void share()}
        />
        {note.chain ? (
          <IconButton
            accessibilityLabel="See this note's proof"
            accessibilityHint="Shows the public record for this note"
            // DESIGN_SYSTEM.md §6: the stamp is the only motif allowed to represent
            // proof. This was the checkmark-in-a-shield §2 names as the thing to avoid.
            icon={<KeptStamp status={note.chain?.status} size={22} />}
            onPress={() => setProofOpen(true)}
          />
        ) : null}
        <IconButton
          accessibilityLabel="Report this note"
          icon={<Ionicons name="flag-outline" size={22} color={colors.ink} />}
          onPress={() => { setReportError(undefined); setReportOpen(true); }}
        />
      </View>

      {note.chain && !note.chain.explorerUrl ? <Notice>{chainPendingCopy(note.chain.status)}</Notice> : null}
      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}

      <Divider />
      <Text style={{ color: colors.ink, fontSize: 21 * fontScale, fontWeight: "700" }}>Comments</Text>

      {note.commentsEnabled ? (
        <>
          <Field
            multiline
            placeholder="Add a thoughtful comment"
            value={body}
            onChangeText={setBody}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Comment as</Text>
          <BylinePicker identities={identities} selectedId={commentIdentityId} onSelect={(identity) => setCommentIdentityId(identity.id)} />
          <Action
            title="Post comment"
            icon={<Ionicons name="send-outline" size={18} color={colors.onBrand} />}
            onPress={() => void postComment()}
          />
        </>
      ) : (
        <Subtitle>Comments are disabled for this note.</Subtitle>
      )}

      {comments.data.data.map((comment) => (
        <Card key={comment.id}>
          {comment.author ? (
            <Link href={`/profile/${comment.author.username}`}>
              <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 15 * fontScale }}>{comment.author.displayName}</Text>
            </Link>
          ) : (
            <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 15 * fontScale }}>
              {comment.isAnonymous ? "Anonymous" : comment.authorDisplayName || "NotesChain reader"}
            </Text>
          )}
          <Text style={{ color: colors.ink, fontSize: 15 * fontScale }}>{comment.body}</Text>
          <Subtitle>{new Date(comment.createdAt).toLocaleString()}</Subtitle>
        </Card>
      ))}

      <ProofSheet
        visible={proofOpen}
        publication={note}
        onClose={() => setProofOpen(false)}
      />
      <ReportDialog
        visible={reportOpen}
        submitting={reporting}
        error={reportError}
        onCancel={() => setReportOpen(false)}
        onSubmit={(reason) => void report(reason)}
      />
      <CaptchaSheet
        visible={captchaOpen}
        onCancel={() => setCaptchaOpen(false)}
        onVerified={(captchaToken) => { setCaptchaOpen(false); void postComment(captchaToken); }}
      />
    </Screen>
  );
}
