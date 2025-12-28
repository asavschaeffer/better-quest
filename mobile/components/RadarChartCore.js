import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText, G } from "react-native-svg";

// Stat definitions with colors
export const STAT_ATTRS = [
  { key: "STR", label: "STR", color: "#ef4444" },
  { key: "DEX", label: "DEX", color: "#f97316" },
  { key: "STA", label: "STA", color: "#eab308" },
  { key: "INT", label: "INT", color: "#3b82f6" },
  { key: "SPI", label: "SPI", color: "#a855f7" },
  { key: "CHA", label: "CHA", color: "#ec4899" },
  { key: "VIT", label: "VIT", color: "#22c55e" },
];

/**
 * RadarChartCore - Pure display renderer for radar/spider charts
 *
 * @param {number} size - Chart size in pixels
 * @param {number[]} values - Array of 7 values (normalized 0-1 or 0-maxValue)
 * @param {number} minValue - Minimum value (maps to inner ring, default 0)
 * @param {number} maxValue - Maximum value for scaling (default 1 for normalized)
 * @param {object[]} overlays - Additional shapes: [{ values, fill, stroke, strokeWidth, strokeDasharray }]
 * @param {number} rings - Number of concentric guide rings
 * @param {number[]} ringValues - Optional explicit ring values (overrides `rings` when provided)
 * @param {boolean} showLabels - Show stat labels around the chart
 * @param {boolean} showAxisLines - Show axis lines from center
 * @param {number} activeAxis - Index of highlighted axis (-1 for none)
 * @param {string} fill - Polygon fill color
 * @param {string} stroke - Polygon stroke color
 * @param {React.ReactNode} centerContent - Content to render in center
 * @param {Array<{key: string, label: string, color?: string}>} attrs - Axis definitions (defaults to STAT_ATTRS)
 * @param {number} radiusScale - Scales chart geometry radii (rings/polygon/axes). Default 1.
 * @param {number} maxRadiusMult - Base multiplier for max radius before scaling (default 0.35).
 * @param {number} minRadiusMult - Base multiplier for min radius before scaling (default 0.08).
 * @param {number} labelRadiusMult - Multiplier for label radius (default 0.45). Smaller values pull labels inward.
 * @param {Record<string, number>} ringRadiusScaleByValue - Optional per-ring radius scale (e.g. { "1": 1.06, "2": 1.04 })
 * @param {number} backgroundPad - Extra padding (px) added to the background circle radius beyond maxRadius (default 14)
 * @param {object} style - Additional container styles
 */
export function RadarChartCore({
  size = 260,
  values = [0, 0, 0, 0, 0, 0, 0],
  minValue = 0,
  maxValue = 1,
  overlays = [],
  rings = 4,
  ringValues = null,
  showLabels = true,
  showAxisLines = true,
  activeAxis = -1,
  fill = "rgba(99,102,241,0.4)",
  stroke = "rgba(129,140,248,0.9)",
  strokeWidth = 3,
  centerContent = null,
  attrs = STAT_ATTRS,
  radiusScale = 1,
  maxRadiusMult = 0.35,
  minRadiusMult = 0.08,
  labelRadiusMult = 0.45,
  ringRadiusScaleByValue = null,
  backgroundPad = 14,
  style,
}) {
  const safeAttrs = Array.isArray(attrs) && attrs.length ? attrs : STAT_ATTRS;
  const numStats = safeAttrs.length;
  const safeValues =
    Array.isArray(values) && values.length
      ? safeAttrs.map((_, i) => (typeof values[i] === "number" ? values[i] : 0))
      : safeAttrs.map(() => 0);

  // Geometry
  const s =
    typeof radiusScale === "number" && Number.isFinite(radiusScale) && radiusScale > 0
      ? radiusScale
      : 1;
  const maxMult =
    typeof maxRadiusMult === "number" && Number.isFinite(maxRadiusMult) && maxRadiusMult > 0
      ? maxRadiusMult
      : 0.35;
  const minMult =
    typeof minRadiusMult === "number" && Number.isFinite(minRadiusMult) && minRadiusMult >= 0
      ? minRadiusMult
      : 0.08;
  const maxRadius = size * maxMult * s;
  const minRadius = size * minMult * s;
  const cx = size / 2;
  const cy = size / 2;
  const labelMult =
    typeof labelRadiusMult === "number" && Number.isFinite(labelRadiusMult) && labelRadiusMult > 0
      ? labelRadiusMult
      : 0.45;
  const labelRadius = size * labelMult * s; // Proportional to fit labels within bounds
  const bgPad =
    typeof backgroundPad === "number" && Number.isFinite(backgroundPad) && backgroundPad >= 0
      ? backgroundPad
      : 14;

  // Convert value to radius (handles minValue for 1-6 scales)
  const valueToRadius = (value) => {
    const range = maxValue - minValue;
    const clamped = Math.max(minValue, Math.min(maxValue, value));
    const t = range > 0 ? (clamped - minValue) / range : 0;
    return minRadius + t * (maxRadius - minRadius);
  };

  // Get angle for axis index (starts at top, goes clockwise)
  const getAxisAngle = (index) => {
    return (Math.PI * 2 * index) / numStats - Math.PI / 2;
  };

  // Build polygon points string
  const buildPoints = (vals) => {
    return vals
      .map((val, i) => {
        const angle = getAxisAngle(i);
        const r = valueToRadius(val);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");
  };

  // Get axis endpoint
  const getAxisEnd = (index) => {
    const angle = getAxisAngle(index);
    return {
      x: cx + Math.cos(angle) * maxRadius,
      y: cy + Math.sin(angle) * maxRadius,
    };
  };

  // Get label position
  const getLabelPos = (index) => {
    const angle = getAxisAngle(index);
    return {
      x: cx + Math.cos(angle) * labelRadius,
      y: cy + Math.sin(angle) * labelRadius,
    };
  };

  // Ring levels (evenly distributed from minValue to maxValue)
  const ringLevels = Array.isArray(ringValues) && ringValues.length
    ? ringValues.filter((v) => typeof v === "number" && Number.isFinite(v))
    : Array.from({ length: rings + 1 }, (_, i) =>
        minValue + (i / rings) * (maxValue - minValue)
      );

  const mainPoints = buildPoints(safeValues);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {/* Background */}
        <Circle cx={cx} cy={cy} r={maxRadius + bgPad} fill="#0a0f1a" />

        {/* Guide rings */}
        {ringLevels.map((level, i) => {
          const baseR = valueToRadius(level);
          const key = String(level);
          const scaleRaw = ringRadiusScaleByValue?.[key];
          const scale =
            typeof scaleRaw === "number" && Number.isFinite(scaleRaw) && scaleRaw > 0
              ? scaleRaw
              : 1;
          const r = Math.min(maxRadius, baseR * scale);

          return (
            <Circle
              key={`ring-${i}-${level}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={i === 0 ? "#374151" : "rgba(100,116,139,0.25)"}
              strokeWidth={i === 0 ? 2 : 1}
              strokeDasharray={i > 0 ? "4,4" : undefined}
            />
          );
        })}

        {/* Axis lines */}
        {showAxisLines &&
          safeAttrs.map((attr, i) => {
            const end = getAxisEnd(i);
            const isActive = activeAxis === i;
            return (
              <Line
                key={`axis-${i}`}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke={isActive ? attr.color : "rgba(100,116,139,0.3)"}
                strokeWidth={isActive ? 2 : 1}
              />
            );
          })}

        {/* Overlay polygons (rendered behind main) */}
        {overlays.map((overlay, idx) => (
          <Polygon
            key={`overlay-${idx}`}
            points={buildPoints(overlay.values)}
            fill={overlay.fill || "rgba(251,191,36,0.2)"}
            stroke={overlay.stroke || "rgba(251,191,36,0.6)"}
            strokeWidth={overlay.strokeWidth || 2}
            strokeDasharray={overlay.strokeDasharray || "4,3"}
            strokeLinejoin="round"
          />
        ))}

        {/* Main polygon */}
        <Polygon
          points={mainPoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* Stat labels */}
        {showLabels &&
          safeAttrs.map((attr, i) => {
            const pos = getLabelPos(i);
            const isActive = activeAxis === i;
            return (
              <SvgText
                key={`label-${i}`}
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={isActive ? attr.color : "#9ca3af"}
              >
                {attr.label}
              </SvgText>
            );
          })}

        {/* Center content (rendered as foreignObject would be ideal but using G for now) */}
        {centerContent && (
          <G x={cx} y={cy}>
            {centerContent}
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RadarChartCore;
