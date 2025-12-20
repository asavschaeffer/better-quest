import React from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Polygon } from "react-native-svg";
import Animated, { useSharedValue, useDerivedValue, useAnimatedProps, withSpring } from "react-native-reanimated";

import { updateClay, snapToNearestLevels, DEFAULT_LEVELS } from "./ClayLogic.js";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

export default function LiquidEditor({
  size,
  numStats = 7,
  maxRadius,
  levels = DEFAULT_LEVELS,
  initial = 0.5,
  stroke = "rgba(79,70,229,1)",
  fill = "rgba(99,102,241,0.35)",
  strokeWidth = 4,
}) {
  const SIZE = size;
  const CENTER = SIZE / 2;
  const MAX_RADIUS = maxRadius ?? SIZE * 0.42;

  // Keep hooks rule-compliant: explicit shared values (7 stats).
  // If we later make this truly dynamic, we'll store the array in a single shared value.
  const r0 = useSharedValue(initial);
  const r1 = useSharedValue(initial);
  const r2 = useSharedValue(initial);
  const r3 = useSharedValue(initial);
  const r4 = useSharedValue(initial);
  const r5 = useSharedValue(initial);
  const r6 = useSharedValue(initial);
  const radii = [r0, r1, r2, r3, r4, r5, r6];

  const activeIndex = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin((event) => {
      const x = event.x - CENTER;
      const y = event.y - CENTER;
      const angle = Math.atan2(y, x);
      const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
      activeIndex.value = Math.round(normalized / (Math.PI * 2 / numStats)) % numStats;
    })
    .onUpdate((event) => {
      const idx = activeIndex.value ?? 0;
      const x = event.x - CENTER;
      const y = event.y - CENTER;
      const dist = Math.sqrt(x * x + y * y);
      const targetNorm = dist / MAX_RADIUS;

      const current = new Array(numStats);
      for (let i = 0; i < numStats; i++) current[i] = radii[i].value;

      const next = updateClay(current, idx, targetNorm, { levels });
      for (let i = 0; i < numStats; i++) radii[i].value = next[i];
    })
    .onEnd(() => {
      const current = new Array(numStats);
      for (let i = 0; i < numStats; i++) current[i] = radii[i].value;
      const snapped = snapToNearestLevels(current, { levels });
      for (let i = 0; i < numStats; i++) {
        radii[i].value = withSpring(snapped[i], { damping: 20, stiffness: 200 });
      }
    });

  const points = useDerivedValue(() => {
    let pts = "";
    for (let i = 0; i < numStats; i++) {
      const angle = i * (Math.PI * 2 / numStats) - Math.PI / 2;
      const r = radii[i].value * MAX_RADIUS;
      const x = CENTER + r * Math.cos(angle);
      const y = CENTER + r * Math.sin(angle);
      pts += `${x},${y} `;
    }
    return pts.trim();
  });

  const polygonProps = useAnimatedProps(() => ({
    points: points.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrapper, { width: SIZE, height: SIZE }]}>
        <Svg height={SIZE} width={SIZE}>
          <AnimatedPolygon animatedProps={polygonProps} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </Svg>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});


