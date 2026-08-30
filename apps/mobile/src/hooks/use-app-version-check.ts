import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { checkAndroidAppVersion, type AppVersionCheckResult } from "@/src/lib/app-version";

export type AppVersionCheckState =
  | { status: "checking"; optionalPromptDismissed: boolean }
  | (AppVersionCheckResult & { optionalPromptDismissed: boolean });

const INITIAL_STATE: AppVersionCheckState = { status: "checking", optionalPromptDismissed: false };

/** Checks at launch and each foreground transition; an optional "Later" is session-scoped. */
export function useAppVersionCheck() {
  const [state, setState] = useState<AppVersionCheckState>(INITIAL_STATE);
  const optionalPromptDismissed = useRef(false);
  const latestCheckId = useRef(0);

  const check = useCallback(async () => {
    const checkId = latestCheckId.current + 1;
    latestCheckId.current = checkId;
    setState({ status: "checking", optionalPromptDismissed: optionalPromptDismissed.current });
    const result = await checkAndroidAppVersion();
    // A slow launch request must not overwrite a newer foreground request.
    if (checkId !== latestCheckId.current) return;
    if (result.status !== "optional") optionalPromptDismissed.current = false;
    setState({ ...result, optionalPromptDismissed: optionalPromptDismissed.current });
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void check();
    });
    return () => subscription.remove();
  }, [check]);

  const dismissOptionalPrompt = useCallback(() => {
    optionalPromptDismissed.current = true;
    setState((current) => ({ ...current, optionalPromptDismissed: true }));
  }, []);

  return { ...state, dismissOptionalPrompt, check };
}
