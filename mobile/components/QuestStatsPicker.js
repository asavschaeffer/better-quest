import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";

const NUM_STATS = 7;
const MAX_ALLOCATION = 2; // Quest stats are 0-2
const VISUAL_MAX = 2.6;   // Visual extends beyond for drag feedback
const RECEDE_SPEED = 0.03;
const VISUAL_BUFFER = 0.1;
// In "scaled ring" mode, we should rest based on the actual ring radius (not value-space guesses).
// Small padding (pixels) outside the ring makes the blob look "set" without changing thresholds.
const REST_PAD_PX_L0 = 6;
const REST_PAD_PX_L1 = 7;
const REST_PAD_PX_L2 = 8;

/**
 * QuestStatsPicker - Interactive stat allocation with duration ring
 *
 * Combines RadarChart interaction with a thin duration ring display.
 * Uses 0-2 scale for quest stat allocation with threshold snapping.
 *
 * @param {object} props
 * @param {object} props.allocation - Current allocation { STR: 0, DEX: 1, ... }
 * @param {function} props.onAllocationChange - Callback when allocation changes
 * @param {number} props.duration - Duration in minutes
 * @param {function} props.onDurationChange - Callback when duration changes
 * @param {number} props.size - Chart size in pixels
 * @param {boolean} props.disabled - Disable all interaction
 * @param {object} props.targetOverlay - Optional overlay for target stats
 */
export function QuestStatsPicker({
  allocation = {},
  onAllocationChange,
  duration = 25,
  onDurationChange,
  size = 260,
  disabled = false,
  targetOverlay = null,
  radarScale = 1,
  ringRadiusScaleByValue = null,
}) {
  // Convert allocation object to values array
  const allocationToValues = useCallback((alloc) => {
    return STAT_ATTRS.map((attr) => {
      const v = alloc?.[attr.key] ?? 0;
      return Math.max(0, Math.min(MAX_ALLOCATION, v));
    });
  }, []);

  // Convert values array to allocation object
  const valuesToAllocation = useCallback((vals) => {
    const alloc = {};
    STAT_ATTRS.forEach((attr, i) => {
      const v = typeof vals?.[i] === "number" ? vals[i] : 0;
      alloc[attr.key] = Math.max(0, Math.min(MAX_ALLOCATION, Math.floor(v)));
    });
    return alloc;
  }, []);

  // Internal animated values (can have decimals for animation)
  const [values, setValues] = useState(() => allocationToValues(allocation));
  const [activeAxis, setActiveAxis] = useState(-1);
  const activeSector = useRef(-1);
  const isDraggingStats = useRef(false);
  const lastFloors = useRef(allocationToValues(allocation).map(Math.floor));
  const animationRef = useRef(null);

  const lastNotifiedAlloc = useRef(allocation);
  const valuesRef = useRef(values);

  // Keep valuesRef in sync
  valuesRef.current = values;

  // Sync with external allocation changes (only if different from current)
  useEffect(() => {
    if (isDraggingStats.current) return;

    const newValues = allocationToValues(allocation);
    const currentFloors = valuesRef.current.map(Math.floor);
    const newFloors = newValues.map(Math.floor);

    // Only sync if the floors are actually different
    const isDifferent = newFloors.some((f, i) => f !== currentFloors[i]);
    if (isDifferent) {
      setValues(newValues);
      lastFloors.current = newFloors;
      lastNotifiedAlloc.current = allocation;
    }
  }, [allocation, allocationToValues]);

  // Geometry - treat size as outer container, inset for labels
  const aroundPad = 28;
  const outerSize = size;
  const innerSize = Math.max(200, outerSize - aroundPad * 2);
  const cx = outerSize / 2;
  const cy = outerSize / 2;

  // Duration constraints
  const durationMin = 1;
  const durationMax = 120;
  const TWO_PI = Math.PI * 2;
  const startAngle = -Math.PI / 2; // 12 o'clock

  // Get axis angle
  const getAxisAngle = useCallback(
    (index) => (Math.PI * 2 * index) / NUM_STATS - Math.PI / 2,
    []
  );

  // Detect which sector a point is in
  const angleToSector = useCallback((angle) => {
    const sector = (Math.PI * 2) / NUM_STATS;
    const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.round(norm / sector) % NUM_STATS;
  }, []);

  // Convert distance from center to value (visual max is 2.6, allocation max is 2)
  // Keep this in sync with RadarChartCore's maxRadiusMult so threshold rings line up with interaction.
  const effectiveRadarScale =
    typeof radarScale === "number" && Number.isFinite(radarScale) && radarScale > 0
      ? radarScale
      : 1;
  const radarMaxRadiusMult = 0.38; // larger concentric circle radii
  const radarMinRadiusMult = 0.08;
  const radarMaxRadius = innerSize * radarMaxRadiusMult * effectiveRadarScale;
  const radarMinRadius = innerSize * radarMinRadiusMult * effectiveRadarScale;

  const ringScaleFor = useCallback(
    (level) => {
      const key = String(level);
      const sRaw = ringRadiusScaleByValue?.[key];
      return typeof sRaw === "number" && Number.isFinite(sRaw) && sRaw > 0 ? sRaw : 1;
    },
    [ringRadiusScaleByValue],
  );

  const radiusForLevel = useCallback(
    (level) => {
      // Mirror RadarChartCore.valueToRadius(level), then apply optional per-ring scaling.
      const t = VISUAL_MAX > 0 ? Math.max(0, Math.min(1, level / VISUAL_MAX)) : 0;
      const base = radarMinRadius + t * (radarMaxRadius - radarMinRadius);
      return Math.min(radarMaxRadius, base * ringScaleFor(level));
    },
    [radarMinRadius, radarMaxRadius, ringScaleFor],
  );

  const distanceToValue = useCallback(
    (dist) => {
      const d = Math.max(0, Math.min(radarMaxRadius, dist));

      // Keep threshold mapping aligned with the *visual ring radii* (including per-ring scaling).
      const r1 = radiusForLevel(1);
      const r2 = radiusForLevel(2);

      // Piecewise mapping so +1 and +2 thresholds land on their scaled ring radii.
      if (d <= r1 || r1 <= 0) {
        const denom = Math.max(1e-6, r1);
        return (d / denom) * 1;
      }
      if (d <= r2 || r2 <= r1) {
        const denom = Math.max(1e-6, r2 - r1);
        return 1 + ((d - r1) / denom) * 1;
      }
      const denom = Math.max(1e-6, radarMaxRadius - r2);
      return 2 + ((d - r2) / denom) * (VISUAL_MAX - 2);
    },
    [radarMaxRadius, radiusForLevel],
  );

  const restingValueForFloor = useCallback(
    (floor) => {
      const f = Math.max(0, Math.min(MAX_ALLOCATION, floor));
      if (f <= 0) {
        const r0 = radiusForLevel(0) + REST_PAD_PX_L0;
        return distanceToValue(r0);
      }
      const pad = f >= 2 ? REST_PAD_PX_L2 : REST_PAD_PX_L1;
      const r = radiusForLevel(f) + pad;
      return distanceToValue(r);
    },
    [radiusForLevel, distanceToValue],
  );

  // Duration display helper
  const durationToProgress = (dur) =>
    Math.max(0, Math.min(1, (dur - durationMin) / (durationMax - durationMin)));

  const buildArcStrokePath = (r, startA, endA) => {
    const x1 = cx + Math.cos(startA) * r;
    const y1 = cy + Math.sin(startA) * r;
    const x2 = cx + Math.cos(endA) * r;
    const y2 = cy + Math.sin(endA) * r;
    const delta = endA - startA;
    const largeArcFlag = Math.abs(delta) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  // Check for threshold crossing and trigger haptic
  const checkThresholdCrossing = useCallback(
    (sector, newValue) => {
      const newFloor = Math.floor(newValue);
      const oldFloor = lastFloors.current[sector];

      if (newFloor !== oldFloor) {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        lastFloors.current[sector] = newFloor;
      }
    },
    []
  );

  // Animation loop - recede to resting point
  useEffect(() => {
    const animate = () => {
      setValues((prev) => {
        let changed = false;
        const next = prev.map((val, i) => {
          if (isDraggingStats.current && i === activeSector.current) return val;

          // Clamp floor to MAX_ALLOCATION for resting point calculation
          const floor = Math.min(MAX_ALLOCATION, Math.floor(val));
          const restingPoint = floor > 0 ? restingValueForFloor(floor) : 0;
          const diff = val - restingPoint;

          if (Math.abs(diff) > 0.001) {
            changed = true;
            if (diff > 0) {
              return Math.max(restingPoint, val - RECEDE_SPEED);
            } else {
              return Math.min(restingPoint, val + RECEDE_SPEED);
            }
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
  }, [restingValueForFloor]);

  // Refs to hold callbacks to avoid dependency issues
  const onAllocationChangeRef = useRef(onAllocationChange);
  onAllocationChangeRef.current = onAllocationChange;

  // Notify parent of allocation changes (only when floors change)
  useEffect(() => {
    const callback = onAllocationChangeRef.current;
    if (!callback) return;

    const newAlloc = valuesToAllocation(values);
    const lastAlloc = lastNotifiedAlloc.current;

    // Check if allocation actually changed
    const changed = !lastAlloc || STAT_ATTRS.some(
      (attr) => newAlloc[attr.key] !== lastAlloc[attr.key]
    );

    if (changed) {
      lastNotifiedAlloc.current = newAlloc;
      callback(newAlloc);
    }
  }, [values, valuesToAllocation]);

  // Handle stat drag
  const handleStatStart = useCallback(
    (x, y) => {
      if (disabled) return;

      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      const sector = angleToSector(angle);

      activeSector.current = sector;
      isDraggingStats.current = true;
      setActiveAxis(sector);
    },
    [disabled, cx, cy, angleToSector]
  );

  const handleStatMove = useCallback(
    (x, y) => {
      if (disabled || !isDraggingStats.current) return;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const sector = angleToSector(angle);

      if (sector !== activeSector.current) {
        activeSector.current = sector;
        setActiveAxis(sector);
      }

      const newValue = distanceToValue(dist);
      checkThresholdCrossing(sector, newValue);

      setValues((prev) => {
        const next = [...prev];
        next[sector] = newValue;
        return next;
      });
    },
    [disabled, cx, cy, angleToSector, distanceToValue, checkThresholdCrossing]
  );

  const handleStatEnd = useCallback(() => {
    isDraggingStats.current = false;
    activeSector.current = -1;
    setActiveAxis(-1);
  }, []);

  // Gesture handler for stat interaction
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      if (disabled) return;

      const x = e.x;
      const y = e.y;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radarMaxRadius * 1.2) {
        handleStatStart(x, y);
      }
    })
    .onUpdate((e) => {
      if (isDraggingStats.current) {
        handleStatMove(e.x, e.y);
      }
    })
    .onEnd(() => {
      handleStatEnd();
    });

  // Build overlays array for RadarChartCore
  const overlays = targetOverlay
    ? [
        {
          values: STAT_ATTRS.map((attr) => targetOverlay[attr.key] ?? 0),
          fill: "rgba(251,191,36,0.2)",
          stroke: "rgba(251,191,36,0.6)",
          strokeWidth: 2,
          strokeDasharray: "4,3",
        },
      ]
    : [];

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { width: outerSize, height: outerSize }]}>
        {/* Radar chart layer */}
        <View style={{ position: "absolute", left: aroundPad, top: aroundPad }}>
          <RadarChartCore
            size={innerSize}
          values={values}
          maxValue={VISUAL_MAX}
          ringValues={[0, 1, 2]}
            ringRadiusScaleByValue={ringRadiusScaleByValue}
          overlays={overlays}
          rings={MAX_ALLOCATION}
          showLabels={false}
          activeAxis={activeAxis}
          fill="rgba(99,102,241,0.4)"
          stroke="rgba(129,140,248,0.9)"
          radiusScale={radarScale}
            maxRadiusMult={radarMaxRadiusMult}
            minRadiusMult={radarMinRadiusMult}
          centerContent={
            <>
              <SvgText
                x={0}
                y={-4}
                textAnchor="middle"
                fontSize={28}
                fill="rgba(229,231,235,1)"
                fontWeight="bold"
              >
                {duration}
              </SvgText>
              <SvgText
                x={0}
                y={16}
                textAnchor="middle"
                fontSize={14}
                fill="rgba(156,163,175,1)"
              >
                min
              </SvgText>
            </>
          }
          />
        </View>

        {/* Duration ring drawn around the chart */}
        <Svg
          width={outerSize}
          height={outerSize}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {(() => {
            const ringStroke = 2;
            const ringR = radarMaxRadius + 14;
            const progress = durationToProgress(duration);
            if (progress <= 0) return null;

            const endAngle = startAngle + progress * TWO_PI;
            const isFull = progress >= 0.999;

            return (
              <>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  stroke="rgba(99,102,241,0.18)"
                  strokeWidth={ringStroke}
                  fill="none"
                />
                {isFull ? (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={ringR}
                    stroke="#6366f1"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : (
                  <Path
                    d={buildArcStrokePath(ringR, startAngle, endAngle)}
                    stroke="#6366f1"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </>
            );
          })()}
        </Svg>

        {/* Stat labels above the duration ring */}
        <Svg
          width={outerSize}
          height={outerSize}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {STAT_ATTRS.map((attr, i) => {
            const angle = getAxisAngle(i);
            const labelRadius = outerSize * 0.44;
            const x = cx + Math.cos(angle) * labelRadius;
            const y = cy + Math.sin(angle) * labelRadius;
            const isActive = activeAxis === i;
            return (
              <SvgText
                key={`label-front-${attr.key}`}
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={13}
                fontWeight="bold"
                fill={isActive ? attr.color : "#9ca3af"}
              >
                {attr.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default QuestStatsPicker;
