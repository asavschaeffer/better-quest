import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as SvgText, G } from "react-native-svg";
import { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";

const MAX_STAT = 6;
const MIN_STAT = 1;

/**
 * PlayerStatsChart - Radar chart for displaying player stats with grade labels
 *
 * Wraps RadarChartCore for the player stats use case (1-6 scale, E-S grades).
 * Used on HomeScreen and HistoryScreen for read-only stat display.
 *
 * @param {object} props
 * @param {object} props.value - Stats object { STR: 3, DEX: 2, ... } (1-6 scale)
 * @param {number} props.size - Chart size in pixels
 * @param {number} props.showTotalExp - Total EXP to display in center
 * @param {object[]} props.overlays - Overlay polygons [{ value: {...}, stroke, fill, dash }]
 * @param {object} props.style - Container style
 */
export function PlayerStatsChart({
  value = {},
  size = 200,
  showTotalExp = null,
  overlays = [],
  style,
}) {
  // Convert object format to array for RadarChartCore
  const values = STAT_ATTRS.map((attr) => {
    const v = value?.[attr.key] ?? 3;
    // Normalize from 1-6 to 0-maxValue for RadarChartCore
    return Math.max(MIN_STAT, Math.min(MAX_STAT, v));
  });

  // Convert overlay objects to array format
  const convertedOverlays = overlays.map((overlay) => ({
    values: STAT_ATTRS.map((attr) => overlay.value?.[attr.key] ?? 3),
    fill: overlay.fill || "rgba(251,191,36,0.16)",
    stroke: overlay.stroke || "rgba(251,191,36,0.7)",
    strokeWidth: overlay.strokeWidth || 2,
    strokeDasharray: overlay.dash || "4,3",
  }));

  // Build center content SVG for total EXP
  const centerContent = showTotalExp !== null ? (
    <G>
      <SvgText
        x={0}
        y={-4}
        textAnchor="middle"
        fontSize={Math.max(16, size * 0.1)}
        fill="#fbbf24"
        fontWeight="bold"
      >
        {showTotalExp.toLocaleString()}
      </SvgText>
      <SvgText
        x={0}
        y={12}
        textAnchor="middle"
        fontSize={Math.max(9, size * 0.05)}
        fill="#9ca3af"
      >
        TOTAL EXP
      </SvgText>
    </G>
  ) : null;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <RadarChartCore
        size={size}
        values={values}
        minValue={MIN_STAT}
        maxValue={MAX_STAT}
        overlays={convertedOverlays}
        rings={3}
        showLabels={true}
        activeAxis={-1}
        fill="rgba(56,189,248,0.45)"
        stroke="rgba(59,130,246,0.9)"
        strokeWidth={2}
        centerContent={centerContent}
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

export default PlayerStatsChart;
