import { useState, useRef, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * useRadarInteraction - Hook for radar chart drag interaction with threshold snapping
 *
 * @param {object} options
 * @param {number} options.size - Chart size for coordinate calculations
 * @param {number} options.maxValue - Maximum value (default 3 for quest stats)
 * @param {number} options.numStats - Number of axes (defaults to initialValues.length or 7)
 * @param {number} options.recedeSpeed - Speed of recede animation (default 0.03)
 * @param {number} options.visualBuffer - Buffer past threshold for resting point (default 0.1)
 * @param {boolean} options.haptics - Enable haptic feedback (default true)
 * @param {boolean} options.disabled - Disable all interaction
 * @param {number[]} options.initialValues - Initial values array
 * @param {function} options.onChange - Callback when values change (receives floors)
 *
 * @returns {object} { values, activeAxis, handlers, allocation }
 */
export function useRadarInteraction({
  size = 260,
  maxValue = 3,
  numStats,
  recedeSpeed = 0.03,
  visualBuffer = 0.1,
  haptics = true,
  disabled = false,
  initialValues = [0, 0, 0, 0, 0, 0, 0],
  onChange,
} = {}) {
  const resolvedNumStats =
    typeof numStats === "number" && Number.isFinite(numStats) && numStats > 0
      ? Math.floor(numStats)
      : Array.isArray(initialValues) && initialValues.length
      ? initialValues.length
      : 7;

  const normalizeValues = useCallback(
    (vals) =>
      Array.from({ length: resolvedNumStats }, (_, i) =>
        typeof vals?.[i] === "number" && Number.isFinite(vals[i]) ? vals[i] : 0
      ),
    [resolvedNumStats],
  );

  const [values, setValues] = useState(() => normalizeValues(initialValues));
  const [activeAxis, setActiveAxis] = useState(-1);
  const activeSector = useRef(-1);
  const isDragging = useRef(false);
  const lastFloors = useRef(normalizeValues(initialValues).map((v) => Math.floor(v)));
  const animationRef = useRef(null);

  // Geometry
  const maxRadius = size * 0.35;
  const cx = size / 2;
  const cy = size / 2;

  // Get axis angle (starts at top, goes clockwise)
  const getAxisAngle = useCallback(
    (index) => (Math.PI * 2 * index) / resolvedNumStats - Math.PI / 2,
    [resolvedNumStats]
  );

  // Detect which sector a point is in
  const angleToSector = useCallback((angle) => {
    const sector = (Math.PI * 2) / resolvedNumStats;
    const norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.round(norm / sector) % resolvedNumStats;
  }, [resolvedNumStats]);

  // Convert distance from center to value
  const distanceToValue = useCallback(
    (dist) => {
      const clamped = Math.max(0, Math.min(maxRadius, dist));
      return (clamped / maxRadius) * maxValue;
    },
    [maxRadius, maxValue]
  );

  // Check for threshold crossing and trigger haptic
  const checkThresholdCrossing = useCallback(
    (sector, newValue) => {
      if (!haptics) return;

      const newFloor = Math.floor(newValue);
      const oldFloor = lastFloors.current[sector];

      if (newFloor !== oldFloor) {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        lastFloors.current[sector] = newFloor;
      }
    },
    [haptics]
  );

  // Animation loop - recede to resting point when not dragging
  useEffect(() => {
    const animate = () => {
      setValues((prev) => {
        let changed = false;
        const next = prev.map((val, i) => {
          // Skip active sector while dragging
          if (isDragging.current && i === activeSector.current) return val;

          const floor = Math.floor(val);
          // Resting point: floor + buffer for allocated stats, 0 for unallocated
          const restingPoint = floor > 0 ? floor + visualBuffer : 0;
          const diff = val - restingPoint;

          if (Math.abs(diff) > 0.001) {
            changed = true;
            // Recede toward resting point
            if (diff > 0) {
              return Math.max(restingPoint, val - recedeSpeed);
            } else {
              return Math.min(restingPoint, val + recedeSpeed);
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
  }, [recedeSpeed, visualBuffer]);

  // Notify parent of allocation changes (floors only)
  useEffect(() => {
    if (onChange) {
      const allocation = values.map((v) => Math.floor(v));
      onChange(allocation);
    }
  }, [values, onChange]);

  // Handle drag start
  const handleStart = useCallback(
    (x, y) => {
      if (disabled) return;

      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      const sector = angleToSector(angle);

      activeSector.current = sector;
      isDragging.current = true;
      setActiveAxis(sector);
    },
    [disabled, cx, cy, angleToSector]
  );

  // Handle drag move
  const handleMove = useCallback(
    (x, y) => {
      if (disabled || !isDragging.current) return;

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

  // Handle drag end
  const handleEnd = useCallback(() => {
    isDragging.current = false;
    activeSector.current = -1;
    setActiveAxis(-1);
  }, []);

  // Responder handlers for React Native
  const handlers = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    onResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      handleStart(locationX, locationY);
    },
    onResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      handleMove(locationX, locationY);
    },
    onResponderRelease: handleEnd,
    onResponderTerminate: handleEnd,
  };

  // Current allocation (integer floors)
  const allocation = values.map((v) => Math.floor(v));

  return {
    values,
    setValues,
    activeAxis,
    allocation,
    handlers,
    handleStart,
    handleMove,
    handleEnd,
  };
}

export default useRadarInteraction;
