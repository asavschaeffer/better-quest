import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText, G, Path } from "react-native-svg";
import { QUEST_STAT_MAX_PER_STAT, getQuestStatTotal } from "./core/models";

// Quest stat allocation wheel with +/- buttons + optional duration ring
// Stats: 0-3 per stat (no total cap)

const ATTRS = [
  { key: "STR", label: "STR", color: "#ef4444" },
  { key: "DEX", label: "DEX", color: "#f97316" },
  { key: "STA", label: "STA", color: "#eab308" },
  { key: "INT", label: "INT", color: "#3b82f6" },
  { key: "SPI", label: "SPI", color: "#a855f7" },
  { key: "CHA", label: "CHA", color: "#ec4899" },
  { key: "VIT", label: "VIT", color: "#22c55e" },
];

function getAxisAngle(index, total) {
  return (Math.PI * 2 * index) / total - Math.PI / 2;
}

export function QuestStatsWheel({
  value,
  onChange,
  duration,
  onDurationChange,
  size = 300,
  disabled = false,
}) {
  const [activeAxis, setActiveAxis] = useState(null);
  const [isDraggingDuration, setIsDraggingDuration] = useState(false);
  const containerRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const rotationModeRef = useRef(false);

  // Duration settings
  const hasDuration = typeof duration === "number" && typeof onDurationChange === "function";
  const durationMin = 1;
  const durationMax = 120;
  const TWO_PI = Math.PI * 2;
  const startAngleBase = -Math.PI / 2;

  // Geometry
  const maxRadius = size * 0.26;
  const minRadius = size * 0.08;
  const totalAxes = ATTRS.length;
  
  // Duration ring geometry
  const durationGap = 12;
  const durationThickness = hasDuration ? 40 : 0;
  const durationInnerR = maxRadius + durationGap;
  const durationOuterR = durationInnerR + durationThickness;
  const durationStartRadius = durationInnerR - 6;
  
  const chartSize = size;
  const cx = chartSize / 2;
  const cy = chartSize / 2;

  const stats = useMemo(() => {
    const base = {};
    ATTRS.forEach((attr) => {
      base[attr.key] = value?.[attr.key] ?? 0;
    });
    return base;
  }, [value]);

  const total = useMemo(() => getQuestStatTotal(stats), [stats]);

  // Duration helpers
  const durationToProgress = (dur) =>
    Math.max(0, Math.min(1, (dur - durationMin) / (durationMax - durationMin)));

  const angleToDuration = (angle) => {
    let progress = (angle - startAngleBase) / TWO_PI;
    progress = ((progress % 1) + 1) % 1;
    return Math.max(durationMin, Math.min(durationMax, 
      Math.round(durationMin + progress * (durationMax - durationMin))
    ));
  };

  const setDurationFromAngle = (angle) => {
    if (!hasDuration) return;
    const next = angleToDuration(angle);
    onDurationChange?.(next);
  };

  // Map 0-3 to visual radius
  const getPointOnAxis = (index, val) => {
    const angle = getAxisAngle(index, totalAxes);
    const clampedVal = Math.max(0, Math.min(3, val));
    const radius = minRadius + (clampedVal / 3) * (maxRadius - minRadius);
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

  // Position for stat controls (outside the duration ring if present)
  const getControlPosition = (index) => {
    const angle = getAxisAngle(index, totalAxes);
    const radius = hasDuration ? durationOuterR + 32 : maxRadius + 48;
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
    const val = Math.round((clampedDistance / maxRadius) * 3);
    return Math.max(0, Math.min(3, val));
  };

  const trySetStat = (key, newVal) => {
    if (disabled) return;
    
    const currentVal = stats[key] ?? 0;
    const clampedNew = Math.max(0, Math.min(QUEST_STAT_MAX_PER_STAT, newVal));
    
    if (clampedNew !== currentVal) {
      onChange?.({ ...stats, [key]: clampedNew });
    }
  };

  const handleStatAdjust = (x, y) => {
    if (disabled) return;
    
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius * 1.3) return;

    const axisIndex = findNearestAxis(x, y);
    const attrKey = ATTRS[axisIndex].key;
    const newVal = calculateStatValue(x, y, axisIndex);

    setActiveAxis(axisIndex);
    trySetStat(attrKey, newVal);
  };

  const handleStart = (nativeEvent) => {
    if (disabled) return;
    const x = nativeEvent.locationX ?? nativeEvent.clientX ?? 0;
    const y = nativeEvent.locationY ?? nativeEvent.clientY ?? 0;

    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Duration ring hit detection
    if (hasDuration && distance >= durationStartRadius && distance <= durationOuterR + 10) {
      rotationModeRef.current = true;
      setIsDraggingDuration(true);
      const angle = Math.atan2(dy, dx);
      setDurationFromAngle(angle);
      return;
    }

    // Dead zone
    if (hasDuration && distance > maxRadius && distance < durationStartRadius) {
      return;
    }

    // Inner chart: stat adjustment
    if (distance <= maxRadius) {
      handleStatAdjust(x, y);
    }
  };

  const handleMove = (nativeEvent) => {
    if (disabled) return;
    const x = nativeEvent.locationX ?? nativeEvent.clientX ?? 0;
    const y = nativeEvent.locationY ?? nativeEvent.clientY ?? 0;

    if (rotationModeRef.current) {
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      setDurationFromAngle(angle);
    } else {
      handleStatAdjust(x, y);
    }
  };

  const handleRelease = () => {
    setActiveAxis(null);
    setIsMouseDown(false);
    rotationModeRef.current = false;
    setIsDraggingDuration(false);
  };

  // Web mouse handlers
  const handleMouseDown = (e) => {
    if (Platform.OS !== "web" || disabled) return;
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
    if (Platform.OS !== "web" || !isMouseDown || disabled) return;
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

  // Build polygon points
  const polygonPoints = ATTRS.map((attr, i) => {
    const statVal = stats[attr.key] ?? 0;
    const visualVal = statVal === 0 ? 0.1 : statVal;
    const point = getPointOnAxis(i, visualVal);
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

  // Duration arc path
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Allocate Stat Points</Text>
      <View style={styles.wheelContainer}>
        <View
          ref={containerRef}
          style={[styles.chartWrapper, { width: chartSize, height: chartSize }]}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled && isMouseDown}
          onResponderGrant={(e) => handleStart(e.nativeEvent)}
          onResponderMove={(e) => handleMove(e.nativeEvent)}
          onResponderRelease={handleRelease}
          onResponderTerminate={handleRelease}
          onMouseDown={handleMouseDown}
        >
          <Svg width={chartSize} height={chartSize} pointerEvents="none">
            {/* Duration ring (optional) */}
            {hasDuration && (() => {
              const ringProgress = durationToProgress(duration);
              const isFull = ringProgress >= 0.999;
              const centerR = (durationInnerR + durationOuterR) / 2;
              const thickness = durationOuterR - durationInnerR;
              const startAngle = startAngleBase;
              const endAngle = startAngle + ringProgress * TWO_PI;
              const handleAngle = endAngle;
              const handleX = cx + Math.cos(handleAngle) * centerR;
              const handleY = cy + Math.sin(handleAngle) * centerR;
              
              return (
                <G>
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={centerR}
                    stroke="rgba(99,102,241,0.16)"
                    strokeWidth={thickness}
                    fill="none"
                  />
                  {isFull ? (
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={centerR}
                      stroke={isDraggingDuration ? "#818cf8" : "#6366f1"}
                      strokeWidth={thickness}
                      fill="none"
                    />
                  ) : ringProgress > 0 ? (
                    <Path
                      d={arcBandPath(durationInnerR, durationOuterR, startAngle, endAngle)}
                      fill={isDraggingDuration ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)"}
                      stroke={isDraggingDuration ? "#818cf8" : "#6366f1"}
                      strokeWidth={isDraggingDuration ? 2 : 1}
                    />
                  ) : null}
                  <Circle
                    cx={handleX}
                    cy={handleY}
                    r={isDraggingDuration ? thickness / 2 : thickness / 2.4}
                    fill={isDraggingDuration ? "#a5b4fc" : "rgba(99,102,241,0.9)"}
                    stroke={isDraggingDuration ? "#4f46e5" : "#1e1b4b"}
                    strokeWidth={isDraggingDuration ? 3 : 2}
                  />
                  <SvgText
                    x={cx}
                    y={cy - durationInnerR - thickness / 2 + 5}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#a5b4fc"
                    fontWeight="bold"
                  >
                    {duration}m
                  </SvgText>
                </G>
              );
            })()}

            {/* Background circle */}
            <Circle cx={cx} cy={cy} r={maxRadius + 8} fill="#020617" />

            {/* Active sector highlight */}
            {activeAxis != null && (
              <Path d={getSectorPath(activeAxis)} fill="rgba(59,130,246,0.18)" />
            )}

            {/* Concentric rings for 0, 1, 2, 3 */}
            {[0, 1, 2, 3].map((level) => {
              const radius = minRadius + (level / 3) * (maxRadius - minRadius);
              return (
                <Circle
                  key={level}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={level === 0 ? "#374151" : "#1f2937"}
                  strokeWidth={level === 0 ? 2 : 1}
                  strokeDasharray={level > 0 ? "4,4" : undefined}
                />
              );
            })}

            {/* Axis lines */}
            {ATTRS.map((attr, i) => {
              const end = getAxisEndpoint(i);
              const isActive = activeAxis === i;
              return (
                <Line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={end.x}
                  y2={end.y}
                  stroke={isActive ? attr.color : "#4b5563"}
                  strokeWidth={isActive ? 2 : 1}
                />
              );
            })}

            {/* Stat polygon */}
            {total > 0 && (
              <Polygon
                points={polygonPoints}
                fill="rgba(56,189,248,0.35)"
                stroke="rgba(59,130,246,0.9)"
                strokeWidth={2}
              />
            )}

            {/* Stat point dots */}
            {ATTRS.map((attr, i) => {
              const statVal = stats[attr.key] ?? 0;
              if (statVal === 0) return null;
              const point = getPointOnAxis(i, statVal);
              const isActive = activeAxis === i;
              return (
                <Circle
                  key={`dot-${attr.key}`}
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 7 : 5}
                  fill={attr.color}
                  stroke="#0b1120"
                  strokeWidth={2}
                />
              );
            })}

            {/* Center: points left indicator */}
            <Circle 
              cx={cx} 
              cy={cy} 
              r={minRadius + 4} 
              fill="#0f172a" 
              stroke="#1f2937"
              strokeWidth={1}
            />
            <SvgText
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              fontSize={16}
              fill="#e5e7eb"
              fontWeight="bold"
            >
              {total}
            </SvgText>
            <SvgText
              x={cx}
              y={cy + 11}
              textAnchor="middle"
              fontSize={8}
              fill="#6b7280"
            >
              total
            </SvgText>
          </Svg>

          {/* +/- Controls for each stat */}
          {ATTRS.map((attr, i) => {
            const pos = getControlPosition(i);
            const statVal = stats[attr.key] ?? 0;
            const canIncrement = statVal < QUEST_STAT_MAX_PER_STAT;
            const canDecrement = statVal > 0;
            
            return (
              <View
                key={attr.key}
                style={[
                  styles.controlContainer,
                  {
                    left: pos.x - 32,
                    top: pos.y - 18,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: statVal > 0 ? attr.color : "#6b7280" }]}>
                  {attr.label}
                </Text>
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={[styles.controlBtn, !canDecrement && styles.controlBtnDisabled]}
                    onPress={() => trySetStat(attr.key, statVal - 1)}
                    disabled={disabled || !canDecrement}
                  >
                    <Text style={[styles.controlBtnText, !canDecrement && styles.controlBtnTextDisabled]}>−</Text>
                  </TouchableOpacity>
                  <View style={[styles.statValueBox, statVal > 0 && { backgroundColor: `${attr.color}22`, borderColor: `${attr.color}66` }]}>
                    <Text style={[styles.statValue, statVal > 0 && { color: attr.color }]}>{statVal}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.controlBtn, !canIncrement && styles.controlBtnDisabled]}
                    onPress={() => trySetStat(attr.key, statVal + 1)}
                    disabled={disabled || !canIncrement}
                  >
                    <Text style={[styles.controlBtnText, !canIncrement && styles.controlBtnTextDisabled]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={styles.helper}>
        Use +/− buttons or drag inside wheel • Max {QUEST_STAT_MAX_PER_STAT} per stat
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 12,
  },
  title: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  wheelContainer: {
    position: "relative",
    paddingTop: 16,
    marginBottom: 12,
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  controlContainer: {
    position: "absolute",
    alignItems: "center",
    width: 64,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  controlBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnDisabled: {
    backgroundColor: "#111827",
  },
  controlBtnText: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 18,
  },
  controlBtnTextDisabled: {
    color: "#374151",
  },
  statValueBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "700",
  },
  helper: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
  },
});

export default QuestStatsWheel;
