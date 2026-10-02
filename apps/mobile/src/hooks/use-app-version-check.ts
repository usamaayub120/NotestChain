import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { checkAndroidAppVersion, type AppVersionCheckResult } from "@/src/lib/app-version";

export type AppVersionCheckState =
  | { status: "checking"; optionalPromptDismissed: boolean }
  | (AppVersionCheckResult & { optionalPromptDismissed: boolean });

const INITIAL_STATE: AppVersionCheckState = { status: "checking", optionalPromptDismissed: false };

/**
 * Checks at launch and each foreground transition; an optional "Later" is
 * session-scoped.
 *
 * Only the launch check reports "checking". Every later check runs in the
 * background and leaves the previous result in place, because _layout.tsx
 * renders a full-screen Loading for that status *instead of* AppNavigator -
 * so re-entering "checking" on every foreground transition unmounted the
 * entire navigator and every screen's local state with it. A writer who
 * switched apps to copy a quote came back to a destroyed editor, and on a
 * slow connection stared at a loading screen for up to the 8s check timeout
 * every single time.
 */
export function useAppVersionCheck() {
  const [state, setState] = useState<AppVersionCheckState>(INITIAL_STATE);
  const optionalPromptDismissed = useRef(false);
  const latestCheckId = useRef(0);

  const check = useCallback(async (options?: { background?: boolean }) => {
    const checkId = latestCheckId.current + 1;
    latestCheckId.current = checkId;
    // The launch check has nothing to show yet, so it may block. A
    // background re-check must not: the app is already on screen.
    if (!options?.background) {
      setState({ status: "checking", optionalPromptDismissed: optionalPromptDismissed.current });
    }
    const result = await checkAndroidAppVersion();
    // A slow launch request must not overwrite a newer foreground request.
    if (checkId !== latestCheckId.current) return;
    if (result.status !== "optional") optionalPromptDismissed.current = false;
    setState({ ...result, optionalPromptDismissed: optionalPromptDismissed.current });
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void check({ background: true });
    });
    return () => subscription.remove();
  }, [check]);

  const dismissOptionalPrompt = useCallback(() => {
    optionalPromptDismissed.current = true;
    setState((current) => ({ ...current, optionalPromptDismissed: true }));
  }, []);

  return { ...state, dismissOptionalPrompt, check };
}
