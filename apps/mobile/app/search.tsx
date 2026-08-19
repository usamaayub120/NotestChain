import { useState } from "react";
import { Link } from "expo-router";
import { Text } from "react-native";
import { api } from "@/src/lib/api";
import type { Page, Publication } from "@/src/lib/models";
import { Action, Field, Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";

export default function SearchScreen() {
  const [term, setTerm] = useState(""); const [result, setResult] = useState<Page<Publication> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const search = async () => { if (!term.trim()) return; setLoading(true); setError(undefined); try { setResult(await api<Page<Publication>>(`/search?q=${encodeURIComponent(term.trim())}&page=1&pageSize=30&sort=relevance`)); } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); } finally { setLoading(false); } };
  return <Screen><Title>Search</Title><Field returnKeyType="search" onSubmitEditing={search} placeholder="Search titles, thoughts, tags…" value={term} onChangeText={setTerm} /><Action title={loading ? "Searching…" : "Search"} disabled={loading || !term.trim()} onPress={search} />{error && <Text style={{ color: "#b91c1c" }}>{error}</Text>}{loading && <Loading label="Searching NotesChain…" />}{result && <><Subtitle>{result.meta.total} result{result.meta.total === 1 ? "" : "s"}</Subtitle>{result.data.map((item) => <Link key={item.id} href={`/note/${item.id}`} style={styles.card}><Text style={{ fontSize: 17, fontWeight: "700" }}>{item.title}</Text><Text numberOfLines={2} style={styles.subtitle}>{item.excerpt}</Text></Link>)}</>}</Screen>;
}
