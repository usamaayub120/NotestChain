import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Action, Eyebrow, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { markOnboardingSeen } from "@/src/lib/first-run";

/**
 * Copy mirrors apps/web's PublicationWarningDialog and draft/[id].tsx's
 * publish-confirmation sheet — this is the one place a new user should form
 * an accurate mental model of the lifecycle before they ever write a word.
 */
const steps = [
  {
    title: "Write privately",
    body: "Drafts are private and save automatically. You choose when to submit a note for review.",
  },
  {
    title: "Review comes before publishing",
    body: "Submitting sends your note to moderation. Approval does not publish it. You confirm publication separately.",
  },
  {
    title: "Publishing is permanent",
    body: "Publishing writes a public record to the blockchain. It cannot be edited or deleted. A pen name is public-facing; NotesChain can still associate it with your account.",
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const finish = () => { void markOnboardingSeen(); router.replace("/"); };
  return <Screen insetTop clearsTabBar={false}>
    <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
      <Eyebrow>How publishing works</Eyebrow>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }} style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
        {steps.map((_, i) => <View key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.brand : colors.border }} />)}
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700", textAlign: "center" }}>Step {step + 1} of {steps.length}</Text>
      <Title>{steps[step].title}</Title>
      <Subtitle>{steps[step].body}</Subtitle>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        {step > 0 && <View style={{ flex: 1 }}><Action title="Back" tone="secondary" onPress={() => setStep((s) => s - 1)} /></View>}
        <View style={{ flex: 1 }}><Action title={isLast ? "Start reading" : "Next"} onPress={() => (isLast ? finish() : setStep((s) => s + 1))} /></View>
      </View>
      {!isLast && <Action title="Skip" tone="secondary" onPress={finish} />}
    </View>
  </Screen>;
}
