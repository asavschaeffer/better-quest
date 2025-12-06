import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText, G, Path } from "react-native-svg";

// Radar chart for Better Quest
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
  progress = 0, // 0-1: session progress (0 = just started, 1 = complete)
  readOnly = false, // disable all interaction during session
  countdownText = null, // e.g. "23:45" - replaces duration display when provided
}) {
  const [activeAxis, setActiveAxis] = useState(null);
  const [displayDuration, setDisplayDuration] = useState(duration);
  const [isDraggingDuration, setIsDraggingDuration] = useState(false);
  const rotationModeRef = useRef(false);
  const containerRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const durationValueRef = useRef(duration);

  // Geometry
  const maxRadius = size * 0.35;
  const minRadius = size * 0.08;
  const totalAxes = ATTRS.length;
  const durationMin = 1;
  const durationMax = 120;
  const TWO_PI = Math.PI * 2;
  const startAngleBase = -Math.PI / 2; // 12 o'clock

  // Duration arc geometry - define first so we can use for hit detection
  const bananaGap = 14;
  const bananaThickness = 52;
  const bananaInnerR = maxRadius + bananaGap;
  const bananaOuterR = bananaInnerR + bananaThickness;

  // Duration drag UX - hit area starts slightly inside the visual arc for easier grabbing
  const durationStartRadius = bananaInnerR - 8;

  // Padding so arc never clips
  const arcPadding = Math.max(0, bananaOuterR - size / 2 + 16);
  const chartSize = size + arcPadding * 2;
  const cx = chartSize / 2;
  const cy = chartSize / 2;

  const stats = useMemo(() => {
    const base = {};
    ATTRS.forEach((attr) => {
      base[attr.key] = value?.[attr.key] ?? 3;
    });
    return base;
  }, [value]);

  useEffect(() => {
    setDisplayDuration(duration);
    durationValueRef.current = duration;
  }, [duration]);

  const durationToProgress = (dur) =>
    Math.max(0, Math.min(1, (dur - durationMin) / (durationMax - durationMin)));

  // Convert angle (from center) directly to duration - handle follows the finger
  const angleToDuration = (angle) => {
    // Normalize angle relative to 12 o'clock (startAngleBase)
    let progress = (angle - startAngleBase) / TWO_PI;
    // Handle wrap-around to keep in 0-1 range
    progress = ((progress % 1) + 1) % 1;
    // Convert to duration
    return Math.max(durationMin, Math.min(durationMax, 
      Math.round(durationMin + progress * (durationMax - durationMin))
    ));
  };

  const setDurationFromAngle = (angle) => {
    const next = angleToDuration(angle);
    durationValueRef.current = next;
    setDisplayDuration(next);
    onDurationChange?.(next);
  };

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

  const arcBandPath = (innerR, outerR, startA, endA) => {
    let s = startA;
    let e = endA;
    if (e < s) e += TWO_PI; // unwrap when crossing 0

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
    if (readOnly) return; // No interaction during session
    
    const x = nativeEvent.locationX ?? nativeEvent.clientX ?? 0;
    const y = nativeEvent.locationY ?? nativeEvent.clientY ?? 0;

    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Duration ring: activate when touching the arc area (with some tolerance)
    if (distance >= durationStartRadius && distance <= bananaOuterR + 12) {
      rotationModeRef.current = true;
      setIsDraggingDuration(true);
      // Immediately set duration to where user touched
      const angle = Math.atan2(dy, dx);
      setDurationFromAngle(angle);
      return;
    }

    // Dead zone between stat chart and duration ring - ignore touches here
    if (distance > maxRadius && distance < durationStartRadius) {
      return;
    }

    // Inner chart: stat adjustment mode
    if (distance <= maxRadius) {
      handleStatAdjust(x, y);
    }
  };

  const handleMove = (nativeEvent) => {
    const x = nativeEvent.locationX ?? nativeEvent.clientX ?? 0;
    const y = nativeEvent.locationY ?? nativeEvent.clientY ?? 0;

    if (rotationModeRef.current) {
      // Direct positioning - handle follows the finger/mouse exactly
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      setDurationFromAngle(angle);
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
    rotationModeRef.current = false;
    setIsDraggingDuration(false);
    setIsMouseDown(false);
  };

  // Web mouse event handlers
  const handleMouseDown = (e) => {
    if (Platform.OS !== "web") return;
    e.preventDefault();
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

  useEffect(() => {
    if (Platform.OS !== "web" || !isMouseDown) return undefined;
    const move = (e) => handleMouseMove(e);
    const up = () => handleMouseUp();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isMouseDown]);

  // Duration bonus: continuous scale, weighted by stat focus
  // High-focus stats (4-5) get full bonus, low-focus stats (1-2) get minimal bonus
  const maxBonusTicks = Math.min(2, displayDuration / 60);
  
  // Calculate bonus for each stat
  const statBonuses = useMemo(() => {
    return ATTRS.map((attr) => {
      const baseStat = stats[attr.key];
      const weight = (baseStat - 1) / 4; // stat 1 = 0%, stat 5 = 100%
      return maxBonusTicks * weight;
    });
  }, [stats, maxBonusTicks]);

  // Blue polygon: base stats + (bonus * progress) during session
  const polygonPoints = ATTRS.map((attr, i) => {
    const baseStat = stats[attr.key];
    const currentStat = Math.min(5, baseStat + statBonuses[i] * progress);
    const point = getPointOnAxis(i, currentStat);
    return `${point.x},${point.y}`;
  }).join(" ");

  // Yellow polygon: shows full potential (base + full bonus)
  const bonusPolygonPoints = maxBonusTicks > 0.01
    ? ATTRS.map((attr, i) => {
        const baseStat = stats[attr.key];
        const boostedStat = Math.min(5, baseStat + statBonuses[i]);
        const point = getPointOnAxis(i, boostedStat);
        return `${point.x},${point.y}`;
      }).join(" ")
    : null;

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
      {!readOnly && <Text style={styles.title}>What do you want to level up?</Text>}
      <View
        ref={containerRef}
        style={[styles.chartWrapper, { width: chartSize, height: chartSize }]}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handleStart(e.nativeEvent)}
        onResponderMove={(e) => handleMove(e.nativeEvent)}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Svg width={chartSize} height={chartSize}>
          {/* Duration ring - depletes during session */}
          {(() => {
            // During session (readOnly + progress), show remaining time depleting
            const remainingDuration = readOnly && progress > 0
              ? displayDuration * (1 - progress)
              : displayDuration;
            const ringProgress = Math.max(0, Math.min(1, durationToProgress(remainingDuration)));
            const isFull = ringProgress >= 0.999;
            const centerR = (bananaInnerR + bananaOuterR) / 2;
            const thickness = bananaOuterR - bananaInnerR;
            const startAngle = startAngleBase;
            const endAngle = startAngle + ringProgress * TWO_PI;
            const handleAngle = endAngle;
            const handleX = cx + Math.cos(handleAngle) * centerR;
            const handleY = cy + Math.sin(handleAngle) * centerR;
            return (
              <G pointerEvents="none">
                <Circle
                  cx={cx}
                  cy={cy}
                  r={centerR}
                  stroke="rgba(99,102,241,0.16)"
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  fill="none"
                />
                {isFull ? (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={centerR}
                    stroke={isDraggingDuration ? "#818cf8" : "#6366f1"}
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : ringProgress > 0 ? (
                  <Path
                    d={arcBandPath(bananaInnerR, bananaOuterR, startAngle, endAngle)}
                    fill={isDraggingDuration ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)"}
                    stroke={isDraggingDuration ? "#818cf8" : "#6366f1"}
                    strokeWidth={isDraggingDuration ? 2 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {/* Handle - hidden during session, larger when dragging */}
                {!readOnly && (
                  <Circle
                    cx={handleX}
                    cy={handleY}
                    r={isDraggingDuration ? thickness / 2 : thickness / 2.4}
                    fill={isDraggingDuration ? "#a5b4fc" : "rgba(99,102,241,0.9)"}
                    stroke={isDraggingDuration ? "#4f46e5" : "#1e1b4b"}
                    strokeWidth={isDraggingDuration ? 3 : 2}
                  />
                )}
              </G>
            );
          })()}

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

          {/* Duration bonus polygon - golden glow behind main stats */}
          {bonusPolygonPoints && (
            <Polygon
              points={bonusPolygonPoints}
              fill="rgba(251,191,36,0.25)"
              stroke="rgba(251,191,36,0.6)"
              strokeWidth={2}
              strokeDasharray="4,3"
            />
          )}

          {/* Main stat polygon */}
          <Polygon
            points={polygonPoints}
            fill="rgba(56,189,248,0.45)"
            stroke="rgba(59,130,246,0.9)"
            strokeWidth={2}
          />

          {/* Duration/countdown display in center */}
          {countdownText ? (
            <SvgText
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              fontSize={26}
              fill="#e5e7eb"
              fontWeight="bold"
            >
              {countdownText}
            </SvgText>
          ) : (
            <>
              <SvgText
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fontSize={28}
                fill="#e5e7eb"
                fontWeight="bold"
              >
                {displayDuration}
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
            </>
          )}

          {/* Stat point circles - removed for cleaner look
          {ATTRS.map((attr, i) => {
            const point = getPointOnAxis(i, stats[attr.key]);
            const isActive = activeAxis === i;
            return (
              <Circle
                key={attr.key}
                cx={point.x}
                cy={point.y}
                r={isActive ? 6 : 4}
                fill={isActive ? "#f97316" : "#0ea5e9"}
                stroke="#0b1120"
                strokeWidth={1.5}
              />
            );
          })}
          */}

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

          {/* Completion celebration - sparkles when quest complete! */}
          {progress >= 0.99 && readOnly && (
            <G>
              {/* Glow ring */}
              <Circle
                cx={cx}
                cy={cy}
                r={maxRadius + 8}
                fill="none"
                stroke="rgba(251,191,36,0.6)"
                strokeWidth={4}
              />
              {/* Sparkles at each stat point */}
              {ATTRS.map((attr, i) => {
                const baseStat = stats[attr.key];
                const boostedStat = Math.min(5, baseStat + statBonuses[i]);
                const point = getPointOnAxis(i, boostedStat);
                return (
                  <G key={`sparkle-${attr.key}`}>
                    <SvgText
                      x={point.x}
                      y={point.y - 8}
                      textAnchor="middle"
                      fontSize={14}
                    >
                      ✨
                    </SvgText>
                  </G>
                );
              })}
              {/* Center star */}
              <SvgText
                x={cx}
                y={cy - 28}
                textAnchor="middle"
                fontSize={20}
              >
                ⭐
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
      {!readOnly && (
        <Text style={styles.helper}>
          Drag inside chart for stats • Drag the outer ring for duration
        </Text>
      )}
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
