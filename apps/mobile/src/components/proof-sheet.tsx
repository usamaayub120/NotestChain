import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import type { Publication } from "@/src/lib/models";
import { describeKeptState } from "@/src/lib/kept-state";
import { fonts } from "@/src/lib/fonts";
import { useTheme } from "@/src/lib/theme";
import { Action, Subtitle, styles } from "@/src/components/ui";
import { KeptStamp } from "@/src/components/kept-stamp";

/**
 * DESIGN_SYSTEM.md §13's proof presentation, for the native client.
 *
 * Mobile had none of it. The note screen's only proof affordance was an
 * icon that called Linking.openURL and dropped the reader into Solana
 * Explorer -  out of the app, into a block explorer, to look at a
 * transaction. That is the "blockchain product wearing a writing app as a
 * costume" §1 opens by rejecting, and it meant the signature, PDA and slot
 * were never shown in the product at all.
 *
 * §13's order is fixed and followed here: plain language first, then an
 * opt-in technical block of publication PDA, transaction signature, network
 * and slot, then the explorer link for anyone who does want to leave.
 */

const STATE_MESSAGES: Record<string, string> = {
  VERIFIED: "This matches what's on the public record.",
  NOT_FINALIZED: "This hasn't reached the public record yet.",
  ACCOUNT_NOT_FOUND: "We couldn't find this on the public record.",
  HASH_MISMATCH: "This doesn't match the public record - it's been reported for review.",
  PDA_MISMATCH: "This doesn't match the public record - it's been reported for review.",
  UNSUPPORTED_VERSION: "We can't verify this version yet.",
  VERSION_MISMATCH: "Our records and the public record use different versions of this note.",
  RPC_UNAVAILABLE: "We couldn't confirm this right now - try again shortly.",
};

function ProofValue({ label, value }: { label: string; value: string | null }) {
  const { colors, fontScale } = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 * fontScale }}>{label}</Text>
      {/* §4 reserves IBM Plex Mono for exactly this: signatures, PDAs and
          hashes. It had nothing to set, because none of these values
          reached the app. */}
      <Text selectable style={{ color: colors.muted, fontFamily: fonts.proof, fontSize: 12 * fontScale }}>
        {value ?? "Not yet assigned"}
      </Text>
    </View>
  );
}

export function ProofSheet({
  visible,
  publication,
  verificationState,
  onClose,
}: {
  visible: boolean;
  publication: Publication;
  verificationState?: string | null;
  onClose: () => void;
}) {
  const { colors, fontScale } = useTheme();
  const chain = publication.chain;
  const state = describeKeptState(chain?.status, verificationState);
  const plain = verificationState ? (STATE_MESSAGES[verificationState] ?? state.line) : state.line;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 22,
              gap: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={[styles.row, { gap: 10 }]}>
              <KeptStamp status={chain?.status} verification={verificationState} size={22} />
              <Text
                accessibilityRole="header"
                style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20 * fontScale, flex: 1 }}
              >
                {state.line || "Proof"}
              </Text>
            </View>

            {/* Plain language always precedes the technical detail (§13). */}
            <Subtitle>{plain}</Subtitle>

            <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
              <ProofValue label="Publication PDA" value={chain?.publicationPda ?? null} />
              <ProofValue label="Transaction signature" value={chain?.transactionSignature ?? null} />
              <ProofValue label="Network" value={chain?.network ?? null} />
              <ProofValue label="Slot" value={chain?.slot != null ? chain.slot.toLocaleString() : null} />
            </View>

            {chain?.explorerUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="View on Solana Explorer"
                accessibilityHint="Opens your browser"
                onPress={() => void Linking.openURL(chain.explorerUrl!)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <View style={[styles.row, { gap: 6 }]}>
                  <Text style={{ color: colors.brand, fontFamily: fonts.semibold, fontSize: 15 * fontScale }}>
                    View on explorer
                  </Text>
                  <Ionicons name="open-outline" size={16} color={colors.brand} />
                </View>
              </Pressable>
            ) : null}

            <Action title="Close" tone="secondary" onPress={onClose} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
