/**
 * Clay-blob stat picker math helpers.
 * Pure functions - no Reanimated, no React.
 */

export const NUM_STATS = 7;
export const MIN_VAL = 0;
export const MAX_VAL = 2;

/**
 * Get axis index from angle (radians).
 * Angle 0 = right, rotates clockwise. We offset so index 0 is at top (-π/2).
 */
export function axisFromAngle(angle) {
  "worklet";
  const sector = (Math.PI * 2) / NUM_STATS;
  // Normalize to [0, 2π)
  let norm = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  // Round to nearest sector
  return Math.round(norm / sector) % NUM_STATS;
}

/**
 * Distance between two axis indices on a circular ring.
 */
export function circularDistance(a, b) {
  "worklet";
  const d = Math.abs(a - b);
  return Math.min(d, NUM_STATS - d);
}

/**
 * Clamp a value to [MIN_VAL, MAX_VAL].
 */
export function clamp(v) {
  "worklet";
  return Math.max(MIN_VAL, Math.min(MAX_VAL, v));
}

/**
 * Convert finger distance (0..1 normalized) to target pull value (0..2).
 * Non-linear: pulling harder near max gets progressively harder.
 */
export function distanceToTarget(normDist) {
  "worklet";
  // Slight ease-out curve so extremes require more effort
  const curved = Math.pow(Math.min(1, Math.max(0, normDist)), 0.85);
  return clamp(curved * MAX_VAL);
}

/**
 * Integer magnetism: if value is close to an integer, pull it toward that integer.
 * Returns { value, snapped } where snapped=true if we hit an integer.
 * 
 * @param {number} v - current value
 * @param {number} magnetStrength - 0..1, how strongly to pull toward integer (0.3 = gentle, 0.8 = strong)
 * @param {number} threshold - distance from integer to start pulling (e.g. 0.15)
 */
export function applyIntegerMagnetism(v, magnetStrength = 0.3, threshold = 0.18) {
  "worklet";
  const nearest = Math.round(v);
  const dist = Math.abs(v - nearest);
  
  if (dist < 0.01) {
    // Already at integer
    return { value: nearest, snapped: true };
  }
  
  if (dist < threshold) {
    // Within threshold: pull toward integer
    const pull = magnetStrength * (threshold - dist) / threshold;
    const newVal = v + pull * (nearest - v);
    // If we got very close, snap fully
    if (Math.abs(newVal - nearest) < 0.02) {
      return { value: nearest, snapped: true };
    }
    return { value: newVal, snapped: false };
  }
  
  return { value: v, snapped: false };
}

/**
 * Snap a value to nearest integer (for release / axis change).
 */
export function snapToInteger(v) {
  "worklet";
  return clamp(Math.round(v));
}

/**
 * Redistribute "cost" of increasing one axis by thinning others.
 * Prioritizes lowest values first (they shrink before high values do).
 * 
 * @param {number[]} values - current values (length 7)
 * @param {number} activeIdx - index we're pulling (don't thin this one)
 * @param {number} delta - how much we increased the active axis
 * @param {number} coupling - 0..1, how much of delta to redistribute (e.g. 0.5 = half)
 * @returns {number[]} new values
 */
export function thinFromLowest(values, activeIdx, delta, coupling = 0.5) {
  "worklet";
  if (delta <= 0) return values.slice();
  
  const result = values.slice();
  let toRemove = delta * coupling;
  
  // Build list of other indices sorted by value (lowest first)
  const others = [];
  for (let i = 0; i < NUM_STATS; i++) {
    if (i !== activeIdx) {
      others.push({ idx: i, val: result[i] });
    }
  }
  others.sort((a, b) => a.val - b.val);
  
  // Remove from lowest first
  for (const { idx } of others) {
    if (toRemove <= 0) break;
    
    const current = result[idx];
    // How much can we take? Don't go below MIN_VAL.
    // Also add some resistance: higher values are harder to pull down.
    const resistance = 0.3 * (current / MAX_VAL); // 0 at min, 0.3 at max
    const canTake = Math.max(0, current - MIN_VAL) * (1 - resistance);
    const take = Math.min(canTake, toRemove);
    
    result[idx] = current - take;
    toRemove -= take;
  }
  
  return result;
}

/**
 * Apply surface tension smoothing: neighbors of active axis follow partially.
 * 
 * @param {number[]} values - current values
 * @param {number} activeIdx - the axis being pulled
 * @param {number} delta - how much the active axis moved
 * @param {number} spread - 0..1, how much neighbors follow (e.g. 0.25)
 * @returns {number[]} new values
 */
export function applySurfaceTension(values, activeIdx, delta, spread = 0.2) {
  "worklet";
  const result = values.slice();
  
  for (let i = 0; i < NUM_STATS; i++) {
    if (i === activeIdx) continue;
    
    const dist = circularDistance(i, activeIdx);
    if (dist <= 2) {
      // Neighbors within 2 steps get some follow
      const factor = spread * (1 - dist / 3);
      result[i] = clamp(result[i] + delta * factor);
    }
  }
  
  return result;
}

/**
 * Full drag update: pull active axis toward target, apply surface tension, thin from lows.
 * 
 * @param {number[]} values - current values (length 7)
 * @param {number} activeIdx - which axis finger is in
 * @param {number} targetVal - target value based on finger distance
 * @param {object} opts - { followSpeed, tensionSpread, thinCoupling }
 * @returns {number[]} updated values
 */
export function dragUpdate(values, activeIdx, targetVal, opts = {}) {
  "worklet";
  const { followSpeed = 0.4, tensionSpread = 0.15, thinCoupling = 0.4 } = opts;
  
  let result = values.slice();
  const current = result[activeIdx];
  const delta = (targetVal - current) * followSpeed;
  
  // Move active axis toward target
  result[activeIdx] = clamp(current + delta);
  
  // Apply surface tension (neighbors follow a bit)
  if (Math.abs(delta) > 0.01) {
    result = applySurfaceTension(result, activeIdx, delta, tensionSpread);
  }
  
  // Thin from lowest to compensate for increases
  if (delta > 0.02) {
    result = thinFromLowest(result, activeIdx, delta, thinCoupling);
  }
  
  // Apply gentle integer magnetism during drag
  for (let i = 0; i < NUM_STATS; i++) {
    const { value } = applyIntegerMagnetism(result[i], 0.2, 0.12);
    result[i] = value;
  }
  
  return result;
}

/**
 * Snap all values to integers (for release / axis change).
 * Uses a gentler approach: rounds to nearest but clamps to valid range.
 */
export function snapAll(values) {
  "worklet";
  return values.map(v => snapToInteger(v));
}

/**
 * Get the angle for a given axis index (for rendering).
 * Index 0 is at top (-π/2).
 */
export function angleForAxis(idx) {
  "worklet";
  return (idx * Math.PI * 2) / NUM_STATS - Math.PI / 2;
}

