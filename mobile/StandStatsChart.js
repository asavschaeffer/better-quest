import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Line,
  Polygon,
  Text as SvgText,
  G,
  Path,
} from "react-native-svg";

// Radar chart for Better Quest:
// STR, DEX, STA, INT, SPI, CRE, VIT (values 1–5, mapped to grades A–E).
const ATTRS = [
  { key: "STR", label: "STR" },
  { key: "DEX", label: "DEX" },
  { key: "STA", label: "STA" },
  { key: "INT", label: "INT" },
  { key: "SPI", label: "SPI" },
  { key: "CRE", label: "CRE" },
  { key: "VIT", label: "VIT" },
];

const VALUE_TO_GRADE = { 5: "A", 4: "B", 3: "C", 2: "D", 1: "E" };

function getAxisAngle(index, total) {
  // Start from top, go clockwise.
  return (Math.PI * 2 * index) / total - Math.PI / 2;
}

export function StandStatsChart({
  value,
  onChange,
  size = 260,
}) {
  const [activeAxis, setActiveAxis] = useState(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.35;
  const minRadius = size * 0.08;
  const totalAxes = ATTRS.length;

  const stats = useMemo(() => {
    const base = {};
    ATTRS.forEach((attr) => {
      base[attr.key] = value?.[attr.key] ?? 3;
    });
    return base;
  }, [value]);

  const getPointOnAxis = (index, val) => {
    const angle = getAxisAngle(index, totalAxes);
    const radius = minRadius + ((val - 1) / 4) * (maxRadius - minRadius);
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  };

  const getAxisEndpoint = (index) => {
    const angle = getAxisAngle(index, totalAxes);
    return {
      x: cx + Math.cos(angle) * maxRadius,
      y: cy + Math.sin(angle) * maxRadius,
    };
  };

  const getLabelPosition = (index) => {
    const angle = getAxisAngle(index, totalAxes);
    const radius = maxRadius + 26;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  };

  const getGradePosition = (index) => {
    const angle = getAxisAngle(index, totalAxes);
    const radius = maxRadius + 8;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  };

  const findNearestAxis = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    let angle = Math.atan2(dy, dx);
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const sectorSize = (Math.PI * 2) / totalAxes;
    const sector = Math.round(angle / sectorSize) % totalAxes;
    return sector;
  };

  const calculateStatValue = (x, y, axisIndex) => {
    const angle = getAxisAngle(axisIndex, totalAxes);
    const dx = x - cx;
    const dy = y - cy;
    const projectedDistance = dx * Math.cos(angle) + dy * Math.sin(angle);
    const clampedDistance = Math.max(0, Math.min(maxRadius, projectedDistance));
    const val = Math.round(1 + (clampedDistance / maxRadius) * 4);
    return Math.max(1, Math.min(5, val));
  };

  const handlePoint = (nativeEvent) => {
    const { locationX, locationY } = nativeEvent;
    const x = locationX;
    const y = locationY;

    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius * 1.2) {
      return;
    }

    const axisIndex = findNearestAxis(x, y);
    const attrKey = ATTRS[axisIndex].key;
    const newVal = calculateStatValue(x, y, axisIndex);

    setActiveAxis(axisIndex);
    const nextStats = {
      ...stats,
      [attrKey]: newVal,
    };
    onChange?.(nextStats, { primary: getPrimaryAttr(nextStats) });
  };

  const handleRelease = () => {
    setActiveAxis(null);
  };

  const polygonPoints = ATTRS.map((attr, i) => {
    const point = getPointOnAxis(i, stats[attr.key]);
    return `${point.x},${point.y}`;
  }).join(" ");

  const getSectorPath = (index) => {
    const centerAngle = getAxisAngle(index, totalAxes);
    const span = (Math.PI * 2) / totalAxes / 2;
    const startAngle = centerAngle - span;
    const endAngle = centerAngle + span;
    const r = maxRadius + 6;

    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What do you want to level up?</Text>
      <View
        style={[styles.chartWrapper, { width: size, height: size }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handlePoint(e.nativeEvent)}
        onResponderMove={(e) => handlePoint(e.nativeEvent)}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={maxRadius + 18}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={3}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={maxRadius + 12}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1}
          />

          <Circle cx={cx} cy={cy} r={maxRadius + 10} fill="#020617" />

          {activeAxis != null && (
            <Path d={getSectorPath(activeAxis)} fill="rgba(59,130,246,0.18)" />
          )}

          {[1, 2, 3, 4, 5].map((grade) => {
            const radius = minRadius + ((grade - 1) / 4) * (maxRadius - minRadius);
            return (
              <Circle
                key={grade}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="#1f2937"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            );
          })}

          {["A", "B", "C", "D", "E"].map((grade, i) => {
            const radius = minRadius + ((4 - i) / 4) * (maxRadius - minRadius);
            return (
              <SvgText
                key={grade}
                x={cx + 6}
                y={cy - radius + 4}
                fontSize={10}
                fill="#6b7280"
                fontWeight="bold"
              >
                {grade}
              </SvgText>
            );
          })}

          {ATTRS.map((_, i) => {
            const end = getAxisEndpoint(i);
            const isActive = activeAxis === i;
            return (
              <Line
                key={i}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke={isActive ? "#fbbf24" : "#4b5563"}
                strokeWidth={isActive ? 2 : 1}
              />
            );
          })}

          <Polygon
            points={polygonPoints}
            fill="rgba(56,189,248,0.45)"
            stroke="rgba(59,130,246,0.9)"
            strokeWidth={2}
          />

          {ATTRS.map((attr, i) => {
            const point = getPointOnAxis(i, stats[attr.key]);
            const isActive = activeAxis === i;
            return (
              <Circle
                key={attr.key}
                cx={point.x}
                cy={point.y}
                r={isActive ? 9 : 6}
                fill={isActive ? "#f97316" : "#0ea5e9"}
                stroke="#0b1120"
                strokeWidth={2}
              />
            );
          })}

          {ATTRS.map((attr, i) => {
            const labelPos = getLabelPosition(i);
            const gradePos = getGradePosition(i);
            const grade = VALUE_TO_GRADE[stats[attr.key]];
            const isActive = activeAxis === i;

            return (
              <G key={attr.key}>
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y - 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill={isActive ? "#fbbf24" : "#e5e7eb"}
                  fontWeight="bold"
                >
                  {attr.label}
                </SvgText>
                <SvgText
                  x={gradePos.x}
                  y={gradePos.y + 4}
                  textAnchor="middle"
                  fontSize={18}
                  fill={isActive ? "#f97316" : "#fbbf24"}
                  fontWeight="bold"
                >
                  {grade}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      <Text style={styles.helper}>
        Drag or tap in the chart to tell the app which stats you want to level.
      </Text>
    </View>
  );
}

function getPrimaryAttr(stats) {
  let bestKey = ATTRS[0]?.key ?? "STR";
  let bestVal = -Infinity;
  Object.entries(stats).forEach(([key, val]) => {
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  });
  return bestKey;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  helper: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
});


