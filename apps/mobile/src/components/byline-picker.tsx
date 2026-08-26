import { Text, View } from "react-native";
import { Action, Subtitle } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import type { Identity } from "@/src/lib/models";

/**
 * Every note or comment goes out under the Keeper's own profile or one of
 * their pen names — there is no anonymous option here. Keeper profile is
 * always listed first. Mirrors apps/web's IdentityModeSelector/byline
 * picker in CommentComposer.tsx.
 */
export function BylinePicker({
  identities,
  selectedId,
  onSelect,
  emptyHint,
}: {
  identities: Identity[];
  selectedId: string | null;
  onSelect: (identity: Identity) => void;
  /** Shown only when identities hasn't loaded yet — never true once the Keeper profile exists. */
  emptyHint?: string;
}) {
  const { colors } = useTheme();
  const keeperProfile = identities.find((identity) => identity.isPrimary);
  const penNames = identities.filter((identity) => !identity.isPrimary);

  if (identities.length === 0) {
    return <Subtitle>{emptyHint ?? "Loading your Keeper profile…"}</Subtitle>;
  }

  return (
    <View style={{ gap: 8 }}>
      {keeperProfile && (
        <BylineOption
          identity={keeperProfile}
          kind="Your Keeper profile"
          selected={selectedId === keeperProfile.id}
          onPress={() => onSelect(keeperProfile)}
        />
      )}
      {penNames.map((identity) => (
        <BylineOption
          key={identity.id}
          identity={identity}
          kind="Pen name"
          selected={selectedId === identity.id}
          onPress={() => onSelect(identity)}
        />
      ))}
      <Text style={{ color: colors.muted, fontSize: 13 }}>Want another byline? Create a pen name from Account → Pen names.</Text>
    </View>
  );
}

function BylineOption({
  identity,
  kind,
  selected,
  onPress,
}: {
  identity: Identity;
  kind: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Action
      title={`${identity.displayName} (@${identity.username}) · ${kind}`}
      tone={selected ? "primary" : "secondary"}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
    />
  );
}
