import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Draft } from "@/src/lib/models";
import { EmptyNotes } from "@/src/components/publication";
import { Action, Eyebrow, Loading, Screen, Subtitle, Title, colors, styles } from "@/src/components/ui";

export default function DraftsScreen() {
  const query = useQuery({ queryKey: ["drafts"], queryFn: async () => { try { const drafts = await api<Draft[]>("/drafts"); cacheWrite("drafts", drafts); return drafts; } catch { return cacheRead<Draft[]>("drafts") ?? []; } } });
  if (query.isLoading) return <Loading label="Opening your drafts…" />;
  return <Screen><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Your writing desk</Eyebrow><Title>Drafts</Title><Subtitle>Work privately until a note is ready to publish.</Subtitle></View><Action title="New draft" onPress={() => router.push("/draft/new")} icon={<Ionicons name="create-outline" size={19} color="#fff" />} />
    {query.data?.length ? query.data.map((item) => <Link key={item.id} href={`/draft/${item.id}`} asChild><Pressable style={({ pressed }) => [styles.card, { gap: 5 }, pressed && { opacity: 0.76 }]}><Text style={{ color: colors.ink, fontFamily: "serif", fontSize: 20, fontWeight: "700" }}>{item.title || "Untitled draft"}</Text><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Subtitle>{item.status.replaceAll("_", " ")}</Subtitle><Subtitle>{new Date(item.updatedAt).toLocaleDateString()}</Subtitle></View></Pressable></Link>) : <EmptyNotes title="No drafts available" detail="Create a first draft while online, then it will stay with you offline." />}
  </Screen>;
}
