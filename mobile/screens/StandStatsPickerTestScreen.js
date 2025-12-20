import React, { useState, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const SIZE = Math.min(width, height) * 0.95;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE * 0.42;
const MIN_RADIUS = MAX_RADIUS * 0.08;
const NUM_STATS = 7;
const MAX_VALUE = 3;

// Convert stat value (0-3) to visual radius
function valueToRadius(value) {
  const t = value / MAX_VALUE;
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

// Calculate polygon points from values array
function buildPoints(values) {
  let pts = "";
  for (let i = 0; i < NUM_STATS; i++) {
    const angle = (i * Math.PI * 2) / NUM_STATS - Math.PI / 2;
    const r = valueToRadius(values[i]);
    const x = CENTER + r * Math.cos(angle);
    const y = CENTER + r * Math.sin(angle);
    pts += `${x},${y} `;
  }
  return pts.trim();
}

// Convert finger distance to value (0 to ~3.5)
// Allow going slightly past MAX_RADIUS so floor(3.x) = 3
const OUTER_MARGIN = MAX_RADIUS * 0.2; // Extra drag zone beyond outer ring

function distanceToValue(dist) {
  const clamped = Math.min(MAX_RADIUS + OUTER_MARGIN, Math.max(0, dist));
  const t = clamped / MAX_RADIUS;
  return t * MAX_VALUE; // Can go up to ~3.6
}

// Which sector (0-6) is this angle in?
function angleToSector(angle) {
  const sector = (Math.PI * 2) / NUM_STATS;
  const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(norm / sector) % NUM_STATS;
}

// Smooth lerp
const LERP_SPEED = 0.4;
function lerp(current, target, t) {
  return current + (target - current) * t;
}

export default function StandStatsPickerTestScreen() {
  const [values, setValues] = useState([0, 0, 0, 0, 0, 0, 0]);
  const currentSector = useRef(-1);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const dx = e.x - CENTER;
      const dy = e.y - CENTER;
      const angle = Math.atan2(dy, dx);
      currentSector.current = angleToSector(angle);
    })
    .onUpdate((e) => {
      const dx = e.x - CENTER;
      const dy = e.y - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const sector = angleToSector(angle);

      // Target value from finger distance
      const fingerValue = distanceToValue(dist);

      setValues((prev) => {
        const next = [...prev];

        // If sector changed, snap the OLD sector to floor
        if (sector !== currentSector.current && currentSector.current >= 0) {
          const oldSector = currentSector.current;
          next[oldSector] = Math.min(MAX_VALUE, Math.floor(next[oldSector]));
        }

        // Smoothly follow finger in current sector
        next[sector] = lerp(next[sector], fingerValue, LERP_SPEED);

        currentSector.current = sector;
        return next;
      });
    })
    .onEnd(() => {
      // Snap all to floor (the thresholds you exceeded), clamped to valid range
      setValues((prev) => prev.map((v) => Math.min(MAX_VALUE, Math.floor(v))));
      currentSector.current = -1;
    });

  const pointsStr = buildPoints(values);

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
