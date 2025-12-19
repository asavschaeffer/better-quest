import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  withSpring,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

const { width } = Dimensions.get("window");
const SIZE = width * 0.86;
const CENTER = SIZE / 2;
const NUM_STATS = 7;
const MAX_RADIUS = SIZE * 0.42; // visual max
const LEVELS = [0, 0.25, 0.5, 0.75, 1]; // normalized 0-3 → fraction of MAX_RADIUS

const springConfig = { damping: 20, stiffness: 200 }; // snappy but soft

export default function StandStatsPickerTestScreen() {
  const DEBUG_TOUCHES = true;
  const dbg = (...args) => {
    if (!DEBUG_TOUCHES) return;
    // Keep logs compact so Metro doesn't choke during drags.
    // eslint-disable-next-line no-console
    console.log("[StandStatsPickerTest]", ...args);
  };
  const [debugHud, setDebugHud] = useState({ idx: null, value: null, phase: "idle" });
  const [pointsStr, setPointsStr] = useState("");

  // Keep hooks rule-compliant: explicit shared values (7 stats).
  const r0 = useSharedValue(0.5);
  const r1 = useSharedValue(0.5);
  const r2 = useSharedValue(0.5);
  const r3 = useSharedValue(0.5);
  const r4 = useSharedValue(0.5);
  const r5 = useSharedValue(0.5);
  const r6 = useSharedValue(0.5);
  const radii = [r0, r1, r2, r3, r4, r5, r6];

  // Gesture Handler v2 API (works with current Reanimated; avoids deprecated useAnimatedGestureHandler)
  const activeIndex = useSharedValue(0);

  const indexFromPoint = (x, y) => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    const angle = Math.atan2(dy, dx);
    const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
    const sector = Math.PI * 2 / NUM_STATS;
    // Use a half-sector offset so boundaries feel natural (equivalent to rounding).
    return Math.floor((normalized + sector / 2) / sector) % NUM_STATS;
  };

  const pan = Gesture.Pan()
    // Debug: ensure callbacks run on JS so console logs always appear.
    .runOnJS(true)
    .onBegin((event) => {
      dbg("pan begin", {
        x: Math.round(event.x),
        y: Math.round(event.y),
        absX: Math.round(event.absoluteX ?? 0),
        absY: Math.round(event.absoluteY ?? 0),
      });

      const nextIdx = indexFromPoint(event.x, event.y);
      activeIndex.value = nextIdx;
      setDebugHud({ idx: nextIdx, value: radii[nextIdx].value, phase: "begin" });
    })
    .onUpdate((event) => {
      // Throttle update logs to avoid spam.
      if (DEBUG_TOUCHES && Math.random() < 0.06) {
        dbg("pan update", {
          x: Math.round(event.x),
          y: Math.round(event.y),
          idx: activeIndex.value ?? 0,
        });
      }
      // While dragging around the ring, continuously select the nearest axis.
      // This makes it feel like you're "painting" the shape rather than editing a single stat.
      const idx = indexFromPoint(event.x, event.y);
      activeIndex.value = idx;

      const x = event.x - CENTER;
      const y = event.y - CENTER;
      const dist = Math.sqrt(x * x + y * y);
      let targetNorm = Math.min(dist / MAX_RADIUS, 1.5); // allow temp spike

      // progressive resistance beyond 3-equivalent (~1.0 norm)
      if (targetNorm > 1.0) {
        const excess = targetNorm - 1.0;
        targetNorm = 1.0 + excess / (1 + excess * excess); // quadratic damp
      }

      // strong spring to target (uniform feel)
      const current = radii[idx].value;
      const delta = targetNorm - current;
      const sprung = current + delta * 0.3; // ~80-90% catch per frame at normal speed

      // integer magnetism
      const nearestLevel = LEVELS.reduce((a, b) =>
        Math.abs(b - sprung) < Math.abs(a - sprung) ? b : a,
      );
      const magPull = 0.15 * Math.exp(-Math.abs(sprung - nearestLevel) * 10);
      radii[idx].value = Math.max(0, sprung + magPull * Math.sign(nearestLevel - sprung));

      if (DEBUG_TOUCHES && Math.random() < 0.08) {
        setDebugHud({ idx, value: radii[idx].value, phase: "update" });
      }

      // basic asymmetric coupling (pull only)
      if (delta > 0) {
        const compensation = delta * 0.15; // light—tune elasticity
        let totalVuln = 0;
        const vulns = [];
        for (let i = 0; i < NUM_STATS; i++) {
          if (i === idx) continue;
          const v = 1 / (radii[i].value + 0.3); // low → high vuln
          vulns.push(v);
          totalVuln += v;
        }
        for (let i = 0, j = 0; i < NUM_STATS; i++) {
          if (i === idx) continue;
          radii[i].value -= (vulns[j++] / totalVuln) * compensation;
          radii[i].value = Math.max(0, radii[i].value);
        }
      }
    })
    .onEnd(() => {
      dbg("pan end");
      setDebugHud((prev) => ({ ...prev, phase: "end" }));
      // snap each to nearest level independently
      for (let i = 0; i < NUM_STATS; i++) {
        const r = radii[i];
        const nearest = LEVELS.reduce((a, b) =>
          Math.abs(b - r.value) < Math.abs(a - r.value) ? b : a,
        );
        r.value = withSpring(nearest, springConfig);
      }
    });

  const points = useDerivedValue(() => {
    let pts = "";
    for (let i = 0; i < NUM_STATS; i++) {
      const angle = i * (Math.PI * 2 / NUM_STATS) - Math.PI / 2;
      const r = radii[i].value * MAX_RADIUS;
      const x = CENTER + r * Math.cos(angle);
      const y = CENTER + r * Math.sin(angle);
      pts += `${x},${y} `;
    }
    return pts.trim();
  });

  // Reanimated animatedProps + react-native-svg has been flaky across versions.
  // Mirror the derived points string to React state so a normal <Polygon points="..."/> render updates visually.
  useAnimatedReaction(
    () => points.value,
    (next, prev) => {
      if (next === prev) return;
      runOnJS(setPointsStr)(next);
    },
    [],
  );

  function handleReset() {
    dbg("press reset");
    for (let i = 0; i < NUM_STATS; i++) {
      radii[i].value = withSpring(0.5, springConfig);
    }
  }

  return (
    <View
      style={styles.container}
      // Screen-wide responder logs: tells us if *any* touch is arriving to this screen.
      onStartShouldSetResponderCapture={() => {
        dbg("responder capture: startShouldSet");
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        dbg("responder capture: moveShouldSet");
        return false;
      }}
      onResponderGrant={(e) => {
        const ne = e?.nativeEvent ?? {};
        dbg("responder grant", {
          x: Math.round(ne.locationX ?? 0),
          y: Math.round(ne.locationY ?? 0),
          pageX: Math.round(ne.pageX ?? 0),
          pageY: Math.round(ne.pageY ?? 0),
        });
      }}
      onResponderMove={(e) => {
        if (!DEBUG_TOUCHES) return;
        if (Math.random() < 0.04) {
          const ne = e?.nativeEvent ?? {};
          dbg("responder move", {
            x: Math.round(ne.locationX ?? 0),
            y: Math.round(ne.locationY ?? 0),
          });
        }
      }}
      onResponderRelease={() => dbg("responder release")}
      onResponderTerminate={() => dbg("responder terminate")}
    >
      <View style={styles.header}>
        <Text style={styles.title}>StandStats Picker Prototype</Text>
        <Text style={styles.subtitle}>Drag around the ring. Releases snap to discrete levels.</Text>
        <Text style={styles.debug}>
          {`debug: ${debugHud.phase} • idx=${debugHud.idx ?? "-"} • r=${debugHud.value == null ? "-" : debugHud.value.toFixed(3)}`}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={styles.wrapper}
          onTouchStart={() => dbg("wrapper touchStart")}
          onTouchEnd={() => dbg("wrapper touchEnd")}
        >
          <Svg height={SIZE} width={SIZE}>
            <Polygon
              points={pointsStr}
              fill="rgba(99,102,241,0.35)"
              stroke="rgba(79,70,229,1)"
              strokeWidth="4"
            />
          </Svg>
        </Animated.View>
      </GestureDetector>

      <View style={styles.footer}>
        <Pressable onPress={handleReset} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
    paddingHorizontal: 16,
  },
  header: { width: "100%", marginBottom: 14 },
  title: { color: "#f9fafb", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  debug: { color: "#60a5fa", fontSize: 12, marginTop: 6 },
  wrapper: {
    width: SIZE,
    height: SIZE,
    borderRadius: 18,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { width: "100%", marginTop: 14, alignItems: "center" },
  btn: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#4f46e5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnText: { color: "#e5e7eb", fontWeight: "700" },
});


