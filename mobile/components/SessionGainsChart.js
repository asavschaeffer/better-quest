import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Text as SvgText, G } from "react-native-svg";
import { RadarChartCore, STAT_ATTRS } from "./RadarChartCore";
import { questStatsToChartStats } from "../core/questStorage";

/**
 * SessionGainsChart - Shows session gains using the same visualization as StandClockChart
 *
 * Displays:
 * - Blue solid polygon: starting stat values (before session)
 * - Yellow dashed overlay: final stat values (after session)
 * - Center: +EXP total
 *
 * Uses the same 1-6 scale from questStatsToChartStats, modulated by duration.
 *
 * @param {object} props
 * @param {object} props.allocation - Quest stat allocation { STR: 2, INT: 1, ... } (0-2 scale)
 * @param {number} props.durationMinutes - Session duration in minutes
 * @param {number} props.totalExp - Total EXP to display in center
 * @param {number} props.size - Chart size in pixels
 * @param {function} props.onStatPress - Callback when a stat label is pressed
 * @param {object} props.style - Container style
 */
export function SessionGainsChart({
  allocation = {},
  durationMinutes = 0,
  totalExp = 0,
  size = 220,
  onStatPress = null,
  style,
}) {
  // Calculate starting values (before session - just the base, no duration contribution)
  const startValues = useMemo(() => {
    const chart = questStatsToChartStats(allocation, 0);
    return STAT_ATTRS.map((attr) => chart?.[attr.key] ?? 1);
  }, [allocation]);

  // Calculate end values (after session - full duration contribution)
  const endValues = useMemo(() => {
    const chart = questStatsToChartStats(allocation, durationMinutes);
    return STAT_ATTRS.map((attr) => chart?.[attr.key] ?? 1);
  }, [allocation, durationMinutes]);

  // Build overlay for end state (yellow dashed, matching StandClockChart)
  const overlays = useMemo(() => [{
    values: endValues,
    fill: "rgba(251,191,36,0.18)",
    stroke: "rgba(251,191,36,0.6)",
    strokeWidth: 2,
    strokeDasharray: "4,3",
  }], [endValues]);

  // Build center content SVG for total EXP
  const centerContent = (
    <G>
      <SvgText
        x={0}
        y={-4}
        textAnchor="middle"
        fontSize={Math.max(20, size * 0.1)}
        fill="#fbbf24"
        fontWeight="bold"
      >
        +{totalExp.toLocaleString()}
      </SvgText>
      <SvgText
        x={0}
        y={14}
        textAnchor="middle"
        fontSize={Math.max(10, size * 0.05)}
        fill="#9ca3af"
      >
        EXP
      </SvgText>
    </G>
  );

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <RadarChartCore
        size={size}
        values={startValues}
        minValue={1}
        maxValue={6}
        rings={4}
        overlays={overlays}
        showLabels={true}
        activeAxis={-1}
        fill="rgba(56,189,248,0.45)"
        stroke="rgba(59,130,246,0.9)"
        strokeWidth={2}
        centerContent={centerContent}
        onStatPress={onStatPress}
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

export default SessionGainsChart;
