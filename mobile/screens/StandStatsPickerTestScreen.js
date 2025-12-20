import React, { useState, useRef, useEffect } from "react";
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
  const t = Math.min(MAX_VALUE, value) / MAX_VALUE;
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
const OUTER_MARGIN = MAX_RADIUS * 0.2;

function distanceToValue(dist) {
  const clamped = Math.min(MAX_RADIUS + OUTER_MARGIN, Math.max(0, dist));
  const t = clamped / MAX_RADIUS;
  return t * MAX_VALUE;
}

// Which sector (0-6) is this angle in?
function angleToSector(angle) {
  const sector = (Math.PI * 2) / NUM_STATS;
  const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(norm / sector) % NUM_STATS;
}

// Animation speeds
const FOLLOW_SPEED = 0.4; // How fast active sector follows finger
const BASE_RECEDE_SPEED = 0.015; // Base speed for receding to floor
const MAX_RECEDE_SPEED = 0.06; // Max recede speed under tension pressure

export default function StandStatsPickerTestScreen() {
  const [values, setValues] = useState([0, 0, 0, 0, 0, 0, 0]);
  const activeSector = useRef(-1);
  const isDragging = useRef(false);
  const animationRef = useRef(null);

  // Animation loop - runs continuously to handle receding
  useEffect(() => {
    const animate = () => {
      setValues((prev) => {
        const next = [...prev];
        let changed = false;

        // Calculate total "overshoot" (surface tension pressure)
        let totalOvershoot = 0;
        for (let i = 0; i < NUM_STATS; i++) {
          const overshoot = next[i] - Math.floor(next[i]);
          totalOvershoot += overshoot;
        }

        // Higher tension = faster recede for non-active sectors
        const tensionPressure = Math.min(1, totalOvershoot / 2); // Normalize
        const recedeSpeed = BASE_RECEDE_SPEED + tensionPressure * (MAX_RECEDE_SPEED - BASE_RECEDE_SPEED);

        for (let i = 0; i < NUM_STATS; i++) {
          // Skip the actively dragged sector
          if (isDragging.current && i === activeSector.current) continue;

          const floor = Math.floor(next[i]);
          const overshoot = next[i] - floor;

          // If above the floor, recede toward it
          if (overshoot > 0.001) {
            next[i] = Math.max(floor, next[i] - recedeSpeed);
            changed = true;
          }
        }

        return changed ? next : prev;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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

      // Target value from finger distance
      const fingerValue = distanceToValue(dist);

      setValues((prev) => {
        const next = [...prev];

        // Update active sector
        activeSector.current = sector;

        // Smoothly follow finger in current sector
        const current = next[sector];
        next[sector] = current + (fingerValue - current) * FOLLOW_SPEED;

        return next;
      });
    })
    .onEnd(() => {
      isDragging.current = false;
      activeSector.current = -1;
      // Don't snap - let the animation loop handle receding
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
