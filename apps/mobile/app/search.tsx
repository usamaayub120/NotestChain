import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { api } from "@/src/lib/api";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard } from "@/src/components/publication";
import { Action, ErrorText, Eyebrow, Field, Loading, Screen, Subtitle, Title } from "@/src/components/ui";

export default function SearchScreen() {
  const [term, setTerm] = useState(""); const [result, setResult] = useState<Page<Publication> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const search = async () => { if (!term.trim()) return; setLoading(true); setError(undefined); try { setResult(await api<Page<Publication>>(`/search?q=${encodeURIComponent(term.trim())}&page=1&pageSize=30&sort=relevance`)); } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); } finally { setLoading(false); } };
  return <Screen><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Find a thought</Eyebrow><Title>Search NotesChain</Title><Subtitle>Search published titles, tags, and remembered lines.</Subtitle></View><Field returnKeyType="search" onSubmitEditing={search} placeholder="Search thoughts and tags" value={term} onChangeText={setTerm} /><Action title={loading ? "Searching…" : "Search"} disabled={loading || !term.trim()} onPress={search} icon={<Ionicons name="search-outline" size={18} color="#fff" />} />{error && <ErrorText>{error}</ErrorText>}{loading && <Loading label="Searching NotesChain…" />}{result && <><Subtitle>{result.meta.total} result{result.meta.total === 1 ? "" : "s"}</Subtitle>{result.data.length ? result.data.map((item) => <PublicationCard key={item.id} publication={item} />) : <EmptyNotes title="No matching thoughts" detail="Try a different word, phrase, or tag." />}</>}</Screen>;
}
