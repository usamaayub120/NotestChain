import { useEffect, useMemo } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import { useTheme } from "@/src/lib/theme";
import { describeKeptState, type KeptTone } from "@/src/lib/kept-state";

/**
 * DESIGN_SYSTEM.md §6's Kept Stamp, for the native client.
 *
 * Mobile had no stamp of any kind. Feed cards carried no verification
 * indicator at all, and the note screen used `shield-checkmark-outline` -
 * literally the checkmark-in-a-shield §2 names as the thing to avoid, for
 * the one motif §6 says is "the only motif allowed to represent blockchain
 * proof anywhere in the product". `colors.verified` (the `kept` trust green)
 * was referenced zero times in the entire app; the trust signal borrowed the
 * generic accent instead.
 *
 * Drawn from Views rather than SVG: the app has no react-native-svg, and two
 * rings plus a tick is a handful of borders. The rings are deliberately not
 * concentric and the whole mark is rotated a few degrees, which is what
 * keeps §6's "hand-drawn feel" at 18px rather than reading as an icon from a
 * set.
 */
export function KeptStamp({
  status,
  verification,
  size = 18,
}: {
  status?: string | null;
  verification?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const state = describeKeptState(status, verification);
  const opacity = useMemo(() => new Animated.Value(1), []);
  const pulses = state.tone === "pending" && !state.hidden;

  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | null = null;
    if (!pulses) {
      opacity.setValue(1);
      return;
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;
      // §6: "respects prefers-reduced-motion: static at 60% opacity instead".
      if (reduceMotion) {
        opacity.setValue(0.6);
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      mounted = false;
      loop?.stop();
    };
  }, [pulses, opacity]);

  if (state.hidden) return null;

  const color = TONE_COLOR(colors, state.tone);
  const inner = size * 0.64;
  const tickLength = size * 0.26;

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={state.shortLabel}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: [{ rotate: "-6deg" }],
      }}
    >
      {/* Outer ring: hairline. */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, size * 0.05),
          borderColor: color,
        }}
      />
      {/* Inner ring: solid weight, nudged off-centre so the two are not concentric. */}
      <View
        style={{
          position: "absolute",
          width: inner,
          height: inner,
          marginLeft: size * 0.03,
          borderRadius: inner / 2,
          borderWidth: Math.max(1.4, size * 0.095),
          borderColor: color,
        }}
      />
      {state.tone === "kept" && (
        // One short diagonal. A second stroke would make it a checkmark.
        <View
          style={{
            position: "absolute",
            width: tickLength,
            height: Math.max(1.6, size * 0.1),
            borderRadius: size,
            backgroundColor: color,
            transform: [{ rotate: "-42deg" }],
          }}
        />
      )}
      {(state.tone === "problem" || state.tone === "caution") && (
        <>
          <View
            style={{
              position: "absolute",
              top: size * 0.3,
              width: Math.max(1.6, size * 0.1),
              height: size * 0.22,
              borderRadius: size,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: size * 0.6,
              width: Math.max(1.8, size * 0.11),
              height: Math.max(1.8, size * 0.11),
              borderRadius: size,
              backgroundColor: color,
            }}
          />
        </>
      )}
    </Animated.View>
  );
}

function TONE_COLOR(colors: ReturnType<typeof useTheme>["colors"], tone: KeptTone): string {
  if (tone === "kept") return colors.verified;
  if (tone === "problem") return colors.danger;
  if (tone === "caution") return colors.warning;
  return colors.muted;
}
