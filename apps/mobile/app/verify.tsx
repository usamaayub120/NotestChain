import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import type { ProofLookupResult } from "@/src/lib/models";
import { PublicationCard } from "@/src/components/publication";
import { Action, Card, Eyebrow, ErrorText, Field, Loading, Notice, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export default function VerifyScreen() {
  const { colors } = useTheme();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  const query = useQuery({
    queryKey: ["verify", submitted],
    queryFn: () => api<ProofLookupResult>(`/publications/lookup?q=${encodeURIComponent(submitted)}`, { visitor: true }),
    enabled: submitted.length > 0,
  });
  // Captured as plain locals rather than read off query.data inline — a
  // narrowed `query.data?.kind === "x"` check doesn't carry into a nested
  // onPress closure, since TS can't prove the property read hasn't changed
  // by the time that callback runs.
  const onChainAccount = query.data?.kind === "onchain_only" ? query.data.account : null;

  return (
    <Screen>
      <View style={{ gap: 8, paddingTop: 4 }}>
        <View style={styles.row}>
          <Eyebrow>Verify</Eyebrow>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
        </View>
        <Title>Check a note’s public record</Title>
        <Subtitle>
          Paste a note URL, transaction signature, or record address. We’ll match it to the public record.
        </Subtitle>
      </View>

      <View style={{ gap: 7 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>What do you want to verify?</Text>
        <Field
          accessibilityLabel="Note URL, transaction signature, or record address"
          accessibilityHint="Paste a note link, transaction signature, or public record address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Note URL, signature, or address"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => setSubmitted(input.trim())}
          returnKeyType="search"
        />
      </View>
      <Action
        title="Look up"
        disabled={!input.trim()}
        icon={<Ionicons name="search" size={18} color="#fff" />}
        onPress={() => setSubmitted(input.trim())}
      />
      {!submitted && <Notice>You can paste a note link, a transaction signature, or a public record address.</Notice>}

      {query.isFetching && <Loading label="Looking that up…" />}

      {!query.isFetching && query.isError && <ErrorText>Something went wrong looking that up - try again.</ErrorText>}

      {!query.isFetching && query.data?.kind === "not_found" && (
        <Text style={{ color: colors.muted, fontSize: 15 }}>
          We couldn't find a note matching that. Double-check the URL, signature, or address.
        </Text>
      )}

      {!query.isFetching && query.data?.kind === "publication" && <PublicationCard publication={query.data.publication} />}

      {!query.isFetching && onChainAccount && (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
            This on-chain record has no matching entry in our records - it isn't a note published through this
            platform's normal review process. Showing only what's directly on-chain.
          </Text>
          <Text style={{ color: colors.ink, fontFamily: "serif", fontSize: 20, fontWeight: "700", marginTop: 4 }}>
            {onChainAccount.title}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: 4 }}>
            {onChainAccount.content ?? onChainAccount.excerpt}
          </Text>
          <Action
            title="View on Solana Explorer"
            tone="secondary"
            icon={<Ionicons name="open-outline" size={17} color={colors.ink} />}
            onPress={() => void Linking.openURL(onChainAccount.explorerUrl)}
          />
        </Card>
      )}
    </Screen>
  );
}
