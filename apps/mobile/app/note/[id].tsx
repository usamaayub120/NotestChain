import { useEffect, useLayoutEffect, useState } from "react";
import { useLocalSearchParams, Link, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";
import { api, apiPage } from "@/src/lib/api";
import { requestCaptcha } from "@/src/lib/captcha";
import { cacheRead, cacheWrite, enqueue } from "@/src/lib/offline";
import type { Comment, Identity, Page, Publication } from "@/src/lib/models";
import { Action, Card, Divider, ErrorText, Field, IconButton, Loading, Notice, Screen, Subtitle, styles } from "@/src/components/ui";
import { ReportDialog } from "@/src/components/report-dialog";
import { BylinePicker } from "@/src/components/byline-picker";
import { FollowButton } from "@/src/components/follow-button";
import { useTheme } from "@/src/lib/theme";
import { shareNote } from "@/src/lib/share";

const mutationId = () => `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const chainPendingCopy = (status: string) =>
  status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT"
    ? "We hit a snag writing this note to the blockchain. We'll keep retrying — check back soon."
    : "Writing this note to the blockchain — this can take a few minutes. Its verification link will appear here once it's confirmed.";

export default function NoteScreen() {
  const navigation = useNavigation();
  const { colors, fontScale } = useTheme();
  const { id, captchaToken } = useLocalSearchParams<{ id: string; captchaToken?: string }>();

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
      setNotice("Saved on this device — it will sync when you reconnect.");
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

  const openProof = async () => {
    const url = note.chain?.explorerUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open the public record.");
    }
  };

  const postComment = async () => {
    if (!body.trim()) return;
    if (!commentIdentityId) {
      setError("Choose which byline to comment under.");
      return;
    }
    if (!captchaToken) {
      setNotice("Complete the quick verification, then return here to post your comment.");
      await requestCaptcha(`note/${id}`);
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
    <Screen>
      <Text style={{ color: colors.ink, fontFamily: "serif", fontSize: 29 * fontScale, fontWeight: "700", lineHeight: 36 * fontScale }}>
        {note.title}
      </Text>

      {note.author ? (
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Link href={`/profile/${note.author.username}`} style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 16 * fontScale }}>{note.author.displayName}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 * fontScale }}>
              {"\n"}@{note.author.username} · {note.author.isPrimary ? "Primary profile" : "Pen name"}
            </Text>
          </Link>
          <FollowButton username={note.author.username} />
        </View>
      ) : (
        <Subtitle>Anonymous</Subtitle>
      )}
      <Subtitle>{note.publishedAt ? new Date(note.publishedAt).toLocaleDateString() : "Pending publication"}</Subtitle>

      <Text selectable style={{ color: colors.ink, fontSize: 17 * fontScale, lineHeight: 27 * fontScale }}>
        {note.content}
      </Text>

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
        {note.chain?.explorerUrl ? (
          <IconButton
            accessibilityLabel="View the public record"
            accessibilityHint="Opens Solana Explorer in your browser"
            icon={<Ionicons name="shield-checkmark-outline" size={22} color={colors.ink} />}
            onPress={() => void openProof()}
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
            title={captchaToken ? "Post comment" : "Verify & post comment"}
            icon={<Ionicons name="send-outline" size={18} color="#fff" />}
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

      <ReportDialog
        visible={reportOpen}
        submitting={reporting}
        error={reportError}
        onCancel={() => setReportOpen(false)}
        onSubmit={(reason) => void report(reason)}
      />
    </Screen>
  );
}
