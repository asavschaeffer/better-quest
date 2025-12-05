import React, { useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
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
  duration = 25,
  onDurationChange,
  size = 260,
}) {
  const [activeAxis, setActiveAxis] = useState(null);
  const [rotationMode, setRotationMode] = useState(false);
  const [lastAngle, setLastAngle] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const containerRef = useRef(null);

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

  const handleStart = (nativeEvent) => {
    const { locationX, locationY } = nativeEvent;
    const x = locationX;
    const y = locationY;

    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Outer ring (beyond chart): rotation mode for duration
    if (distance > maxRadius + 18) {
      setRotationMode(true);
      const angle = Math.atan2(dy, dx);
      setLastAngle(angle);
      return;
    }

    // Inner chart: stat adjustment mode
    if (distance <= maxRadius * 1.2) {
      setRotationMode(false);
      handleStatAdjust(x, y);
    }
  };

  const handleMove = (nativeEvent) => {
    const { locationX, locationY } = nativeEvent;
    const x = locationX;
    const y = locationY;

    if (rotationMode) {
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);

      if (lastAngle !== null) {
        let delta = angle - lastAngle;
        // Handle angle wrapping
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;

        // Map rotation to duration change (full circle = 60 minutes)
        const minutesPerRadian = 60 / (Math.PI * 2);
        const deltaMinutes = delta * minutesPerRadian;

        onDurationChange?.((prev) => {
          const next = Math.round(prev + deltaMinutes);
          return Math.max(5, Math.min(120, next));
        });
      }

      setLastAngle(angle);
    } else {
      handleStatAdjust(x, y);
    }
  };

  const handleStatAdjust = (x, y) => {
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
    setRotationMode(false);
    setLastAngle(null);
    setIsMouseDown(false);
  };

  // Web mouse event handlers
  const handleMouseDown = (e) => {
    if (Platform.OS !== "web") return;
    setIsMouseDown(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    handleStart({
      locationX: e.clientX - rect.left,
      locationY: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e) => {
    if (Platform.OS !== "web" || !isMouseDown) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    handleMove({
      locationX: e.clientX - rect.left,
      locationY: e.clientY - rect.top,
    });
  };

  const handleMouseUp = () => {
    if (Platform.OS !== "web") return;
    handleRelease();
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

  // Duration ring arc (0-120 minutes, fills clockwise from 12 o'clock)
  const getDurationArcPath = () => {
    const outerR = maxRadius + 18;
    const innerR = maxRadius + 12;
    const progress = Math.max(0, Math.min(1, duration / 120));
    const endAngle = -Math.PI / 2 + progress * Math.PI * 2; // Start at top (-90°), go clockwise

    // If duration is 0, don't draw anything
    if (duration <= 0) return "";

    const largeArcFlag = progress > 0.5 ? 1 : 0;

    const outerStartX = cx + Math.cos(-Math.PI / 2) * outerR;
    const outerStartY = cy + Math.sin(-Math.PI / 2) * outerR;
    const outerEndX = cx + Math.cos(endAngle) * outerR;
    const outerEndY = cy + Math.sin(endAngle) * outerR;

    const innerStartX = cx + Math.cos(-Math.PI / 2) * innerR;
    const innerStartY = cy + Math.sin(-Math.PI / 2) * innerR;
    const innerEndX = cx + Math.cos(endAngle) * innerR;
    const innerEndY = cy + Math.sin(endAngle) * innerR;

    return `
      M ${outerStartX} ${outerStartY}
      A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}
      L ${innerEndX} ${innerEndY}
      A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}
      Z
    `;
  };

  // Chevron rotation hints around the ring
  const getChevronPath = (angleOffset, direction) => {
    const r = maxRadius + 15;
    const angle = angleOffset;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const size = 6;

    if (direction === "cw") {
      // Clockwise chevron (>)
      return `M ${x - size / 2} ${y - size} L ${x + size / 2} ${y} L ${x - size / 2} ${y + size}`;
    } else {
      // Counter-clockwise chevron (<)
      return `M ${x + size / 2} ${y - size} L ${x - size / 2} ${y} L ${x + size / 2} ${y + size}`;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What do you want to level up?</Text>
      <View
        ref={containerRef}
        style={[styles.chartWrapper, { width: size, height: size }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handleStart(e.nativeEvent)}
        onResponderMove={(e) => handleMove(e.nativeEvent)}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Svg width={size} height={size}>
          {/* Outer ring background */}
          <Circle
            cx={cx}
            cy={cy}
            r={maxRadius + 18}
            fill="none"
            stroke="#1f2937"
            strokeWidth={6}
          />

          {/* Duration progress arc */}
          <Path
            d={getDurationArcPath()}
            fill="#4f46e5"
            opacity={0.8}
          />

          {/* Rotation hint chevrons */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
            <Path
              key={i}
              d={getChevronPath(angle, "cw")}
              fill="none"
              stroke={rotationMode ? "#fbbf24" : "#6b7280"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={rotationMode ? 0.9 : 0.4}
            />
          ))}

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

          {/* Duration display in center */}
          <SvgText
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fontSize={28}
            fill="#e5e7eb"
            fontWeight="bold"
          >
            {duration}
          </SvgText>
          <SvgText
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize={14}
            fill="#9ca3af"
          >
            min
          </SvgText>

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
        Drag inside the chart to adjust stats. Rotate outside the ring to change duration.
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


