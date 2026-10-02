import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { apiPage } from "@/src/lib/api";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard } from "@/src/components/publication";
import { Action, ErrorText, Eyebrow, Field, Loading, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export default function SearchScreen() {
  // `q` lets a link arrive with the search already filled in. +native-intent
  // sends /tags/:tag here, because the app has no tag screen and landing on
  // the tag's results is closer to what the link promised than a dead end.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState(q ?? ""); const [result, setResult] = useState<Page<Publication> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const { colors } = useTheme();

  const runSearch = useCallback(async (value: string) => {
    const query = value.trim();
    if (!query) return;
    setLoading(true); setError(undefined);
    try { setResult(await apiPage<Publication>(`/search?q=${encodeURIComponent(query)}&page=1&pageSize=30&sort=relevance`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Search failed."); }
    finally { setLoading(false); }
  }, []);

  const search = () => void runSearch(term);

  // Runs once per incoming `q`, not on every render, so typing over a
  // deep-linked term doesn't re-trigger the original search.
  const searchedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!q || searchedFor.current === q) return;
    searchedFor.current = q;
    setTerm(q);
    void runSearch(q);
  }, [q, runSearch]);
  return <Screen><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Find a note</Eyebrow><Title>Search NotesChain</Title><Subtitle>Search published note titles, tags, and remembered lines.</Subtitle></View><View style={{ gap: 7 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>Search notes</Text><Field accessibilityLabel="Search notes" accessibilityHint="Enter a title, tag, or remembered phrase" returnKeyType="search" onSubmitEditing={search} placeholder="Search notes and tags" value={term} onChangeText={setTerm} /></View><Action title={loading ? "Searching…" : "Search"} disabled={loading || !term.trim()} onPress={search} icon={<Ionicons name="search-outline" size={18} color={colors.onBrand} />} />{!loading && !error && !result && <Notice>Start with a title, a phrase you remember, or a tag such as #life.</Notice>}{error && <ErrorText>{error}</ErrorText>}{loading && <Loading label="Searching NotesChain…" />}{result && <><Subtitle live>{result.meta.total} result{result.meta.total === 1 ? "" : "s"}</Subtitle>{result.data.length ? result.data.map((item) => <PublicationCard key={item.id} publication={item} />) : <EmptyNotes title="No matching notes" detail="Try a different word, phrase, or tag." />}</>}</Screen>;
}
