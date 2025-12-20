import React, { useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const SIZE = Math.min(width, height) * 0.95;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE * 0.42;
const MIN_RADIUS = MAX_RADIUS * 0.08; // Never truly zero visually
const NUM_STATS = 7;
const MAX_VALUE = 3; // Stats go 0-3

// Convert stat value (0-3) to visual radius
function valueToRadius(value) {
  const t = value / MAX_VALUE; // 0-1
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

// Calculate polygon points from radii array
function buildPoints(radii) {
  let pts = "";
  for (let i = 0; i < NUM_STATS; i++) {
    const angle = (i * Math.PI * 2) / NUM_STATS - Math.PI / 2;
    const r = valueToRadius(radii[i]);
    const x = CENTER + r * Math.cos(angle);
    const y = CENTER + r * Math.sin(angle);
    pts += `${x},${y} `;
  }
  return pts.trim();
}

// Convert visual distance to stat value (0-3)
function distanceToValue(dist) {
  // Clamp to valid range
  const clamped = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, dist));
  const t = (clamped - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  return t * MAX_VALUE;
}

export default function StandStatsPickerTestScreen() {
  const [radii, setRadii] = useState([1, 1, 1, 1, 1, 1, 1]); // Start at level 1

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      const dx = e.x - CENTER;
      const dy = e.y - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Which axis?
      const sector = (Math.PI * 2) / NUM_STATS;
      const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const axis = Math.round(norm / sector) % NUM_STATS;

      // Target value (0-3)
      const target = distanceToValue(dist);

      // Update just that axis
      setRadii((prev) => {
        const next = [...prev];
        next[axis] = target;
        return next;
      });
    })
    .onEnd(() => {
      // Snap to nearest integer (0, 1, 2, or 3)
      setRadii((prev) => prev.map((v) => Math.round(v)));
    });

  const pointsStr = buildPoints(radii);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View style={styles.wrapper}>
          <Svg height={SIZE} width={SIZE}>
            {/* Background */}
            <Circle cx={CENTER} cy={CENTER} r={MAX_RADIUS + 4} fill="#0a0f1a" />

            {/* Guide rings for levels 0, 1, 2, 3 */}
            {[0, 1, 2, 3].map((level) => (
              <Circle
                key={level}
                cx={CENTER}
                cy={CENTER}
                r={valueToRadius(level)}
                fill="none"
                stroke="rgba(100,116,139,0.25)"
                strokeWidth={1}
              />
            ))}

            {/* Axis lines */}
            {Array.from({ length: NUM_STATS }).map((_, i) => {
              const angle = (i * Math.PI * 2) / NUM_STATS - Math.PI / 2;
              return (
                <Line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={CENTER + MAX_RADIUS * Math.cos(angle)}
                  y2={CENTER + MAX_RADIUS * Math.sin(angle)}
                  stroke="rgba(100,116,139,0.2)"
                  strokeWidth={1}
                />
              );
            })}

            {/* The blob */}
            <Polygon
              points={pointsStr}
              fill="rgba(99,102,241,0.4)"
              stroke="rgba(129,140,248,0.9)"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
