import React from "react";
import { View, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";
import { useRadarInteraction } from "./useRadarInteraction";

function normalizeValuesArray(values, length) {
  const arr = Array.isArray(values) ? values : [];
  return Array.from({ length }, (_, i) =>
    typeof arr[i] === "number" && Number.isFinite(arr[i]) ? arr[i] : 0
  );
}

/**
 * RadarChart - Interactive radar chart with threshold snapping
 *
 * Composes RadarChartCore with useRadarInteraction for a complete
 * interactive experience with recede animation and haptic feedback.
 *
 * @param {object} props
 * @param {number} props.size - Chart size in pixels (default 260)
 * @param {number} props.maxValue - Maximum value (default 3)
 * @param {number[]} props.initialValues - Starting values
 * @param {function} props.onChange - Callback with allocation (floors) when changed
 * @param {boolean} props.disabled - Disable interaction
 * @param {boolean} props.haptics - Enable haptic feedback (default true)
 * @param {number} props.recedeSpeed - Animation speed (default 0.03)
 * @param {number} props.visualBuffer - Buffer past threshold (default 0.1)
 * @param {object[]} props.overlays - Additional shapes to render
 * @param {boolean} props.showLabels - Show stat labels (default true)
 * @param {string} props.fill - Main polygon fill
 * @param {string} props.stroke - Main polygon stroke
 * @param {React.ReactNode} props.centerContent - Content for center
 * @param {object} props.style - Container style
 */
export function RadarChart({
  size = 260,
  maxValue = 3,
  initialValues = [0, 0, 0, 0, 0, 0, 0],
  onChange,
  disabled = false,
  haptics = true,
  recedeSpeed = 0.03,
  visualBuffer = 0.1,
  overlays = [],
  showLabels = true,
  fill = "rgba(99,102,241,0.4)",
  stroke = "rgba(129,140,248,0.9)",
  centerContent = null,
  attrs = STAT_ATTRS,
  style,
}) {
  const safeAttrs = Array.isArray(attrs) && attrs.length ? attrs : STAT_ATTRS;
  const normalizedInitial = normalizeValuesArray(initialValues, safeAttrs.length);

  const { values, activeAxis, handleStart, handleMove, handleEnd } = useRadarInteraction({
    size,
    maxValue,
    recedeSpeed,
    visualBuffer,
    haptics,
    disabled,
    initialValues: normalizedInitial,
    numStats: safeAttrs.length,
    onChange,
  });

  // Use gesture handler for smoother interaction
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      if (disabled) return;
      handleStart(e.x, e.y);
    })
    .onUpdate((e) => {
      if (disabled) return;
      handleMove(e.x, e.y);
    })
    .onEnd(() => {
      handleEnd();
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, style]}>
        <RadarChartCore
          size={size}
          values={values}
          maxValue={maxValue}
          overlays={overlays}
          rings={maxValue} // One ring per integer level
          showLabels={showLabels}
          activeAxis={activeAxis}
          fill={fill}
          stroke={stroke}
          centerContent={centerContent}
          attrs={safeAttrs}
        />
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

// Re-export for convenience
export { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";
export { useRadarInteraction } from "./useRadarInteraction";

export default RadarChart;
