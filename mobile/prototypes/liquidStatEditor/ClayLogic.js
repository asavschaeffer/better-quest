/**
 * Phase 1: "Clay" constraint / redistribution math.
 *
 * Design goals:
 * - Pure math: no RN/Reanimated imports
 * - Worklet-safe: simple loops, no allocations inside tight loops beyond small arrays
 * - Deterministic: same input -> same output
 *
 * Values are normalized (recommended 0..1), but the algorithm is resilient to small drift.
 */

export const DEFAULT_LEVELS = [0, 0.25, 0.5, 0.75, 1];

function nearestLevel(levels, x) {
  let best = levels[0];
  let bestDist = Math.abs(x - best);
  for (let i = 1; i < levels.length; i++) {
    const v = levels[i];
    const d = Math.abs(x - v);
    if (d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

export function applyMagnetism(levels, x) {
  "worklet";
  const nearest = nearestLevel(levels, x);
  const magPull = 0.15 * Math.exp(-Math.abs(x - nearest) * 10);
  return x + magPull * Math.sign(nearest - x);
}

/**
 * Compute updated radii array for one gesture tick.
 *
 * @param {number[]} values current values (length N)
 * @param {number} activeIndex index being dragged
 * @param {number} targetNorm new intended value (typically 0..1ish)
 * @param {object} opts
 * @returns {number[]} next values (new array)
 */
export function updateClay(values, activeIndex, targetNorm, opts = {}) {
  "worklet";
  const {
    levels = DEFAULT_LEVELS,
    maxValue = 1.0,
    minValue = 0.0,
    resistanceBeyondMax = true,
    maxOvershoot = 1.5,
    follow = 0.3, // "catch-up" factor per tick
    coupling = 0.15, // how much to take from others when active grows
    vulnBias = 0.3, // prevents infinite vuln when values near 0
  } = opts;

  const n = values.length;
  const next = new Array(n);
  for (let i = 0; i < n; i++) next[i] = values[i];

  let t = targetNorm;
  if (t > maxOvershoot) t = maxOvershoot;
  if (t < minValue) t = minValue;

  // progressive resistance beyond maxValue (keeps it "stretchy" but not runaway)
  if (resistanceBeyondMax && t > maxValue) {
    const excess = t - maxValue;
    t = maxValue + excess / (1 + excess * excess);
  }

  const cur = next[activeIndex];
  const delta = t - cur;

  const sprung = cur + delta * follow;
  let updated = sprung;
  updated = applyMagnetism(levels, updated);
  if (updated < minValue) updated = minValue;
  // allow slight overshoot visually; clamp hard floor only
  next[activeIndex] = updated;

  // Asymmetric coupling: only "pull" on growth.
  if (delta > 0 && n > 1) {
    const comp = delta * coupling;

    // vulnerability weighting: lower stats get hit harder (as in your prototype)
    let totalV = 0;
    // store in small array for deterministic second pass
    const vulns = new Array(n - 1);
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i === activeIndex) continue;
      const v = 1 / (next[i] + vulnBias);
      vulns[j++] = v;
      totalV += v;
    }

    j = 0;
    for (let i = 0; i < n; i++) {
      if (i === activeIndex) continue;
      const take = totalV > 0 ? (vulns[j++] / totalV) * comp : 0;
      next[i] = Math.max(minValue, next[i] - take);
    }
  }

  return next;
}

export function snapToNearestLevels(values, opts = {}) {
  "worklet";
  const { levels = DEFAULT_LEVELS } = opts;
  const n = values.length;
  const next = new Array(n);
  for (let i = 0; i < n; i++) {
    next[i] = nearestLevel(levels, values[i]);
  }
  return next;
}


