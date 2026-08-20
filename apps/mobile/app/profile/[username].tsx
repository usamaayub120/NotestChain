import { useLocalSearchParams, Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { api, apiPage } from "@/src/lib/api";
import type { Publication } from "@/src/lib/models";
import { ErrorText, Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";

type Profile = { username: string; displayName: string; bio: string; avatarUrl: string | null; publicationCount: number; joinedAt: string; commonTags: string[] };
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const query = useQuery({ queryKey: ["profile", username], enabled: Boolean(username), queryFn: async () => ({ profile: await api<Profile>(`/profiles/${username}`), notes: await apiPage<Publication>(`/profiles/${username}/publications?page=1&pageSize=30`) }) });
  if (query.isLoading) return <Loading label="Loading profile…" />;
  if (!query.data) return <Screen><ErrorText>This profile could not be found.</ErrorText></Screen>;
  const { profile, notes } = query.data;
  return <Screen><View style={{ alignItems: "center", gap: 5 }}><View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#e7e5e4", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>{profile.displayName.slice(0, 1).toUpperCase()}</Text></View><Title>{profile.displayName}</Title><Subtitle>@{profile.username}</Subtitle>{profile.bio ? <Text>{profile.bio}</Text> : null}<Subtitle>{profile.publicationCount} kept · joined {new Date(profile.joinedAt).toLocaleDateString()}</Subtitle></View>{profile.commonTags.map((tag) => <Text key={tag} style={{ color: "#57534e" }}>#{tag}</Text>)}<View style={styles.divider} />{notes.data.map((note) => <Link key={note.id} href={`/note/${note.id}`} style={styles.card}><Text style={{ fontWeight: "700" }}>{note.title}</Text><Text numberOfLines={2} style={styles.subtitle}>{note.excerpt}</Text></Link>)}</Screen>;
}
