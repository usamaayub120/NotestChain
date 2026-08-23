import { useLayoutEffect } from "react";
import { useLocalSearchParams, Link, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { api, apiPage } from "@/src/lib/api";
import type { Publication } from "@/src/lib/models";
import { Card, Divider, ErrorText, Loading, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

type Profile = { username: string; displayName: string; bio: string; avatarUrl: string | null; publicationCount: number; joinedAt: string; commonTags: string[] };
export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const query = useQuery({ queryKey: ["profile", username], enabled: Boolean(username), queryFn: async () => ({ profile: await api<Profile>(`/profiles/${username}`), notes: await apiPage<Publication>(`/profiles/${username}/publications?page=1&pageSize=30`) }) });
  useLayoutEffect(() => { if (query.data?.profile.username) navigation.setOptions({ title: `@${query.data.profile.username}` }); }, [navigation, query.data?.profile.username]);
  if (query.isLoading) return <Loading label="Loading profile…" />;
  if (!query.data) return <Screen><ErrorText>This profile could not be found.</ErrorText></Screen>;
  const { profile, notes } = query.data;
  return <Screen><View style={{ alignItems: "center", gap: 5 }}><View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.ink, fontSize: 28 }}>{profile.displayName.slice(0, 1).toUpperCase()}</Text></View><Title>{profile.displayName}</Title><Subtitle>@{profile.username}</Subtitle>{profile.bio ? <Text style={{ color: colors.ink }}>{profile.bio}</Text> : null}<Subtitle>{profile.publicationCount} kept · joined {new Date(profile.joinedAt).toLocaleDateString()}</Subtitle></View>{profile.commonTags.map((tag) => <Text key={tag} style={{ color: colors.muted }}>#{tag}</Text>)}<Divider />{notes.data.map((note) => <Link key={note.id} href={`/note/${note.id}`} asChild><Pressable style={({ pressed }) => [pressed && { opacity: 0.76 }]}><Card><Text style={{ color: colors.ink, fontWeight: "700" }}>{note.title}</Text><Text numberOfLines={2} style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>{note.excerpt}</Text></Card></Pressable></Link>)}</Screen>;
}
