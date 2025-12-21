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

// Budget constraint
const BUDGET = 8;

// Calculate dynamic buffer - excess budget distributed across all stats
function calculateBuffer(values) {
  const totalFloors = values.reduce((sum, v) => sum + Math.floor(v), 0);
  const excess = Math.max(0, BUDGET - totalFloors);
  return excess / NUM_STATS;
}

// Animation speeds
const FOLLOW_SPEED = 0.4;
const BASE_RECEDE_SPEED = 0.004; // Very slow passive recede - decimals persist
const MAX_RECEDE_SPEED = 0.02; // Faster under pressure but still visible
const THRESHOLD_BREAK_SPEED = 0.012; // ~0.5-1 sec of sustained pull to break a threshold

// Convert stat value (0-3) to visual radius
function valueToRadius(value) {
  const t = Math.min(MAX_VALUE, value) / MAX_VALUE;
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

// Calculate polygon points from values array
// Values now include the buffer, so visual = value directly
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

export default function StandStatsPickerTestScreen() {
  // Start at level 1 each - regeneration will bring up to floor + buffer
  const [values, setValues] = useState([1, 1, 1, 1, 1, 1, 1]);
  const activeSector = useRef(-1);
  const isDragging = useRef(false);
  const animationRef = useRef(null);

  // Animation loop - handles receding AND budget enforcement
  useEffect(() => {
    const animate = () => {
      setValues((prev) => {
        const next = [...prev];
        let changed = false;

        // === BUDGET ENFORCEMENT ===
        let total = next.reduce((sum, v) => sum + v, 0);

        if (total > BUDGET) {
          let overage = total - BUDGET;

          // PHASE 1: Harvest from decimals (non-active sectors first)
          // Sort by decimal portion descending (take from largest decimals first)
          const decimalContributors = [];
          for (let i = 0; i < NUM_STATS; i++) {
            if (isDragging.current && i === activeSector.current) continue;
            const decimal = next[i] - Math.floor(next[i]);
            if (decimal > 0.001) {
              decimalContributors.push({ idx: i, decimal });
            }
          }
          decimalContributors.sort((a, b) => b.decimal - a.decimal);

          for (const { idx, decimal } of decimalContributors) {
            if (overage <= 0) break;
            const take = Math.min(decimal, overage);
            next[idx] -= take;
            overage -= take;
            changed = true;
          }

          // PHASE 2: Break thresholds (lowest first, with resistance)
          if (overage > 0.001) {
            // Find the lowest non-zero floored value (excluding active sector)
            let lowestIdx = -1;
            let lowestFloor = Infinity;

            for (let i = 0; i < NUM_STATS; i++) {
              if (isDragging.current && i === activeSector.current) continue;
              const floor = Math.floor(next[i]);
              if (floor > 0 && floor < lowestFloor) {
                lowestFloor = floor;
                lowestIdx = i;
              }
            }

            // Apply resistance - only break threshold slowly
            if (lowestIdx >= 0) {
              const take = Math.min(overage, THRESHOLD_BREAK_SPEED);
              next[lowestIdx] -= take;
              changed = true;
            }
          }
        }

        // === NATURAL RECEDE ===
        // Non-active sectors flow back toward their floor
        // Speed influenced by how close we are to budget
        total = next.reduce((sum, v) => sum + v, 0);
        const budgetPressure = Math.min(1, Math.max(0, total / BUDGET));
        const recedeSpeed = BASE_RECEDE_SPEED + budgetPressure * (MAX_RECEDE_SPEED - BASE_RECEDE_SPEED);

        // Calculate dynamic buffer once for this frame
        const buffer = calculateBuffer(next);

        for (let i = 0; i < NUM_STATS; i++) {
          if (isDragging.current && i === activeSector.current) continue;

          const floor = Math.floor(next[i]);
          const target = floor + buffer; // Rest at floor + dynamic buffer
          const overshoot = next[i] - target;

          if (overshoot > 0.001) {
            next[i] = Math.max(target, next[i] - recedeSpeed);
            changed = true;
          }
        }

        // === BUFFER REGENERATION ===
        // When under budget, regenerate toward floor + buffer
        total = next.reduce((sum, v) => sum + v, 0);
        if (total < BUDGET) {
          for (let i = 0; i < NUM_STATS; i++) {
            if (isDragging.current && i === activeSector.current) continue;

            const floor = Math.floor(next[i]);
            const target = floor + buffer;
            const deficit = target - next[i];

            if (deficit > 0.001) {
              const roomToGrow = BUDGET - total;
              const grow = Math.min(deficit, recedeSpeed, roomToGrow);
              next[i] += grow;
              total += grow;
              changed = true;
            }
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

      const fingerValue = distanceToValue(dist);

      setValues((prev) => {
        const next = [...prev];
        activeSector.current = sector;

        // Follow finger (budget enforcement happens in animation loop)
        const current = next[sector];
        next[sector] = current + (fingerValue - current) * FOLLOW_SPEED;

        return next;
      });
    })
    .onEnd(() => {
      isDragging.current = false;
      activeSector.current = -1;
    });

  const pointsStr = buildPoints(values);
  const total = values.reduce((sum, v) => sum + v, 0);

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
