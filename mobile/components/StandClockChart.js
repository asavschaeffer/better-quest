import React, { useMemo, useRef, useState, useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";

/**
 * StandClockChart
 * - Session view: countdown in center
 * - Outer ring shows remaining duration (mapped onto 1..120 minutes like the picker)
 * - Inner radar animates from base stats -> target stats as progress goes 0..1
 * - Supports dragging the duration ring to adjust time
 *
 * value/targetValue are expected to be chart values on a 1..6 scale (E..S),
 * as produced by `questStatsToChartStats`.
 */
export function StandClockChart({
  value,
  targetValue,
  durationMinutes = 25,
  progress = 0,
  size = 320,
  countdownText = null,
  onDurationChange = null,
}) {
  const TWO_PI = Math.PI * 2;
  const startAngle = -Math.PI / 2; // 12 o'clock
  const durationMin = 1;
  const durationMax = 120;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const remainingDuration = Math.max(0, durationMinutes * (1 - clampedProgress));

  const durationToProgress = (dur) =>
    Math.max(0, Math.min(1, (dur - durationMin) / (durationMax - durationMin)));

  // Layout: use the same core geometry as RadarChartCore (maxRadius = size * 0.35),
  // then expand the container so the outer ring never clips.
  const coreMaxRadius = size * 0.35;
  const ringGap = 14;
  const ringThickness = 42;
  const ringInnerR = coreMaxRadius + ringGap;
  const ringOuterR = ringInnerR + ringThickness;
  const ringCenterR = (ringInnerR + ringOuterR) / 2;

  const arcPadding = Math.max(0, ringOuterR - size / 2 + 16);
  const chartSize = size + arcPadding * 2;
  const cx = chartSize / 2;
  const cy = chartSize / 2;

  // The duration ring geometry is computed off `size`, but the SVG canvas expands to `chartSize`
  // to avoid clipping. Keep the radar chart scaled to the original `size` footprint so it
  // doesn't visually collide with the outer duration ring/handle.
  const radarScaleFactor = size / chartSize;
  const radarMaxRadiusMult = 0.35 * radarScaleFactor;
  const radarMinRadiusMult = 0.08 * radarScaleFactor;
  const radarLabelRadiusMult = 0.45 * radarScaleFactor;

  // Drag state for duration adjustment
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastHapticMinute = useRef(null);

  const isInteractive = typeof onDurationChange === "function";

  // Convert angle to duration (1-120 minutes)
  const angleToDuration = (angle) => {
    let progress = (angle - startAngle) / TWO_PI;
    progress = ((progress % 1) + 1) % 1;
    return Math.max(durationMin, Math.min(durationMax,
      Math.round(durationMin + progress * (durationMax - durationMin))
    ));
  };

  const handleDragStart = (x, y) => {
    if (!isInteractive) return;
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Hit detection: anywhere in the ring zone
    if (distance >= ringInnerR - 10 && distance <= ringOuterR + 20) {
      isDraggingRef.current = true;
      setIsDragging(true);
      lastHapticMinute.current = null;
      const angle = Math.atan2(dy, dx);
      const newDuration = angleToDuration(angle);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onDurationChange(newDuration);
    }
  };

  const handleDragMove = (x, y) => {
    if (!isDraggingRef.current || !isInteractive) return;
    const dx = x - cx;
    const dy = y - cy;
    const angle = Math.atan2(dy, dx);
    const newDuration = angleToDuration(angle);

    // Haptic feedback at 5-minute intervals
    const fiveMinMark = Math.round(newDuration / 5) * 5;
    if (lastHapticMinute.current !== fiveMinMark) {
      lastHapticMinute.current = fiveMinMark;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    onDurationChange(newDuration);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Web mouse event handling
  useEffect(() => {
    if (Platform.OS !== "web" || !isDragging) return undefined;
    const handleMouseMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      handleDragMove(e.clientX - rect.left, e.clientY - rect.top);
    };
    const handleMouseUp = () => handleDragEnd();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const ringProgress = durationToProgress(remainingDuration);
  const endAngle = startAngle + ringProgress * TWO_PI;
  const isFull = ringProgress >= 0.999;

  const arcBandPath = (innerR, outerR, startA, endA) => {
    let s = startA;
    let e = endA;
    if (e < s) e += TWO_PI;

    const outerStartX = cx + Math.cos(s) * outerR;
    const outerStartY = cy + Math.sin(s) * outerR;
    const outerEndX = cx + Math.cos(e) * outerR;
    const outerEndY = cy + Math.sin(e) * outerR;

    const innerStartX = cx + Math.cos(s) * innerR;
    const innerStartY = cy + Math.sin(s) * innerR;
    const innerEndX = cx + Math.cos(e) * innerR;
    const innerEndY = cy + Math.sin(e) * innerR;

    const largeArcFlag = e - s > Math.PI ? 1 : 0;

    return `
      M ${outerStartX} ${outerStartY}
      A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}
      L ${innerEndX} ${innerEndY}
      A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}
      Z
    `;
  };

  const { animatedValues, targetValues } = useMemo(() => {
    const base = STAT_ATTRS.map((a) => {
      const v = value?.[a.key];
      return typeof v === "number" && Number.isFinite(v) ? v : 1;
    });
    const target = STAT_ATTRS.map((a, i) => {
      const v = targetValue?.[a.key];
      const resolved = typeof v === "number" && Number.isFinite(v) ? v : base[i];
      return resolved;
    });
    const animated = base.map((b, i) => b + (target[i] - b) * clampedProgress);
    return { animatedValues: animated, targetValues: target };
  }, [value, targetValue, clampedProgress]);

  const overlays = targetValue
    ? [
        {
          values: targetValues,
          fill: "rgba(251,191,36,0.18)",
          stroke: "rgba(251,191,36,0.6)",
          strokeWidth: 2,
          strokeDasharray: "4,3",
        },
      ]
    : [];

  // Handle position for the ring
  const handleAngle = endAngle;
  const handleX = cx + Math.cos(handleAngle) * ringCenterR;
  const handleY = cy + Math.sin(handleAngle) * ringCenterR;

  return (
    <View
      ref={containerRef}
      style={[styles.container, { width: chartSize, height: chartSize }]}
      onStartShouldSetResponder={() => isInteractive}
      onMoveShouldSetResponder={() => isInteractive && isDraggingRef.current}
      onResponderGrant={(e) => handleDragStart(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderMove={(e) => handleDragMove(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderRelease={handleDragEnd}
      onResponderTerminate={handleDragEnd}
      onMouseDown={Platform.OS === "web" ? (e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) handleDragStart(e.clientX - rect.left, e.clientY - rect.top);
      } : undefined}
    >
      {/* Duration ring (remaining time) */}
      <Svg width={chartSize} height={chartSize} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle
          cx={cx}
          cy={cy}
          r={ringCenterR}
          stroke={isDragging ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.16)"}
          strokeWidth={ringThickness}
          strokeLinecap="round"
          fill="none"
        />
        {ringProgress > 0 ? (
          isFull ? (
            <Circle
              cx={cx}
              cy={cy}
              r={ringCenterR}
              stroke={isDragging ? "#818cf8" : "#6366f1"}
              strokeWidth={ringThickness}
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <Path
              d={arcBandPath(ringInnerR, ringOuterR, startAngle, endAngle)}
              fill={isDragging ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)"}
              stroke={isDragging ? "#818cf8" : "#6366f1"}
              strokeWidth={isDragging ? 2 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        ) : null}
        {/* Handle dot on the ring edge */}
        {isInteractive && ringProgress > 0 && (
          <Circle
            cx={handleX}
            cy={handleY}
            r={isDragging ? ringThickness / 2.2 : ringThickness / 2.8}
            fill={isDragging ? "#a5b4fc" : "#6366f1"}
            stroke={isDragging ? "#4f46e5" : "#1e1b4b"}
            strokeWidth={isDragging ? 3 : 2}
          />
        )}
      </Svg>

      <RadarChartCore
        size={chartSize}
        values={animatedValues}
        minValue={1}
        maxValue={6}
        rings={4}
        overlays={overlays}
        showLabels={true}
        activeAxis={-1}
        fill="rgba(56,189,248,0.45)"
        stroke="rgba(59,130,246,0.9)"
        maxRadiusMult={radarMaxRadiusMult}
        minRadiusMult={radarMinRadiusMult}
        labelRadiusMult={radarLabelRadiusMult}
        centerContent={
          countdownText ? (
            <SvgText
              x={0}
              y={8}
              textAnchor="middle"
              fontSize={26}
              fill="#e5e7eb"
              fontWeight="bold"
            >
              {countdownText}
            </SvgText>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default StandClockChart;


