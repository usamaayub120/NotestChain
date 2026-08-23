import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Action, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { markOnboardingSeen } from "@/src/lib/first-run";

/**
 * Copy mirrors apps/web's PublicationWarningDialog and draft/[id].tsx's
 * publish-confirmation sheet — this is the one place a new user should form
 * an accurate mental model of the lifecycle before they ever write a word.
 */
const steps = [
  {
    title: "Private until you decide",
    body: "Drafts live here privately and autosave as you write. Nothing you write is visible to anyone else until you choose to submit it.",
  },
  {
    title: "A moderator reviews before anything is kept",
    body: "Submitting sends your draft for review. Approval does not publish anything by itself — only you do, with one more confirmation afterward.",
  },
  {
    title: "Kept means kept",
    body: "Confirming publication writes your note to a public blockchain. It cannot be edited or deleted after that, and it may stay publicly accessible even if it's later hidden from the site. Anonymous notes are not anonymous to NotesChain itself.",
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const finish = () => { void markOnboardingSeen(); router.replace("/"); };
  return <Screen>
    <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }} style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
        {steps.map((_, i) => <View key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.brand : colors.border }} />)}
      </View>
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
