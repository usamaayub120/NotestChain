import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/src/lib/api";
import type { Draft } from "@/src/lib/models";
import { Action, ErrorText, Screen, Subtitle, Title } from "@/src/components/ui";

export default function NewDraftScreen() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const create = async () => { setBusy(true); setError(undefined); try { const draft = await api<Draft>("/drafts", { method: "POST", body: JSON.stringify({ identityMode: "ANONYMOUS", discoverability: "PUBLIC" }) }); router.replace(`/draft/${draft.id}`); } catch (e) { setError(e instanceof Error ? e.message : "A connection is needed to create your first server draft."); } finally { setBusy(false); } };
  return <Screen><Title>New draft</Title><Subtitle>Drafts are private and autosave while you write. Publishing will always ask you to confirm online.</Subtitle>{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Creating…" : "Start writing"} disabled={busy} onPress={create} /></Screen>;
}
