import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Line, Polygon } from "react-native-svg";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const SIZE = Math.min(width, height) * 0.95;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE * 0.42;
const MIN_RADIUS = MAX_RADIUS * 0.08;
const NUM_STATS = 7;
const MAX_VALUE = 3; // Integer thresholds: 0, 1, 2, 3

// Animation
const RECEDE_SPEED = 0.03; // Speed at which decimals recede to floor

// Convert stat value (0-3) to visual radius
function valueToRadius(value) {
  const t = Math.max(0, Math.min(MAX_VALUE, value)) / MAX_VALUE;
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

// Build polygon points from values (0-3 scale)
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

// Which sector (0-6) is this angle in?
function angleToSector(angle) {
  const sector = (Math.PI * 2) / NUM_STATS;
  const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(norm / sector) % NUM_STATS;
}

// Convert finger distance to value (0 to MAX_VALUE)
function distanceToValue(dist) {
  const clamped = Math.max(0, Math.min(MAX_RADIUS, dist));
  return (clamped / MAX_RADIUS) * MAX_VALUE;
}

export default function StandStatsPickerTestScreen() {
  const [values, setValues] = useState([0, 0, 0, 0, 0, 0, 0]);
  const activeSector = useRef(-1);
  const isDragging = useRef(false);
  const lastFloors = useRef([0, 0, 0, 0, 0, 0, 0]); // Track floors for haptic triggers
  const animationRef = useRef(null);

  // Animation loop - recede decimals to floor when not dragging
  useEffect(() => {
    const animate = () => {
      setValues((prev) => {
        let changed = false;
        const next = prev.map((val, i) => {
          // Skip active sector while dragging
          if (isDragging.current && i === activeSector.current) return val;

          const floor = Math.floor(val);
          const decimal = val - floor;

          if (decimal > 0.001) {
            changed = true;
            return Math.max(floor, val - RECEDE_SPEED);
          }
          return val;
        });
        return changed ? next : prev;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Haptic feedback when crossing thresholds
  const checkThresholdCrossing = (sector, newValue) => {
    const newFloor = Math.floor(newValue);
    const oldFloor = lastFloors.current[sector];

    if (newFloor !== oldFloor) {
      // Crossed a threshold - trigger haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      lastFloors.current[sector] = newFloor;
    }
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      const dx = e.x - CENTER;
      const dy = e.y - CENTER;
      const angle = Math.atan2(dy, dx);
      activeSector.current = angleToSector(angle);
      isDragging.current = true;
    })
    .onUpdate((e) => {
      const dx = e.x - CENTER;
      const dy = e.y - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const sector = angleToSector(angle);

      activeSector.current = sector;
      const newValue = distanceToValue(dist);

      checkThresholdCrossing(sector, newValue);

      setValues((prev) => {
        const next = [...prev];
        next[sector] = newValue;
        return next;
      });
    })
    .onEnd(() => {
      isDragging.current = false;
      activeSector.current = -1;
    });

  const pointsStr = buildPoints(values);

  // Current allocation (floors only - what would be saved)
  const allocation = values.map((v) => Math.floor(v));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View style={styles.wrapper}>
          <Svg height={SIZE} width={SIZE}>
            {/* Background */}
            <Circle cx={CENTER} cy={CENTER} r={MAX_RADIUS + 4} fill="#0a0f1a" />

            {/* Guide rings at integer thresholds: 0, 1, 2, 3 */}
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

            {/* The shape */}
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
