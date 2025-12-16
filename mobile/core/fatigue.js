import { STAT_KEYS } from "./models.js";

// Budget tiers are intentionally simple (no chart-relative inputs):
// map raw lifetime standExp -> "budget points" (1–3) per stat.
//
// With EXP_PER_MINUTE = 1, these thresholds roughly mean:
// - 600 EXP  ~= 10 hours lifetime in that stat
// - 2400 EXP ~= 40 hours lifetime in that stat
//
// Tune these by feel later.
const POINTS_TIER_2_AT_EXP = 600;
const POINTS_TIER_3_AT_EXP = 2400;

export function standExpToPoints(exp) {
  const e = typeof exp === "number" && Number.isFinite(exp) ? Math.max(0, exp) : 0;
  if (e >= POINTS_TIER_3_AT_EXP) return 3;
  if (e >= POINTS_TIER_2_AT_EXP) return 2;
  return 1;
}

// Level factor: gentle scale up to ~1 around level 30+.
export function computeLevelFactor(level = 1) {
  const lv = Math.max(1, Number.isFinite(level) ? level : 1);
  // Level 1 should contribute 0 bonus; level 30 contributes ~full bonus.
  return Math.min(1, (lv - 1) / 29); // level 1 => 0.0, level 30 => 1.0
}

// Streak factor: mandala (per-quest) dominates; aggregate consistency boosts lightly.
export function computeStreakFactor({ mandalaStreak = 0, aggregateConsistency = 0 } = {}) {
  const mandalaScore = Math.min(1, mandalaStreak / 21); // ~3 weeks for full credit
  const aggregateScore = Math.max(0, Math.min(1, aggregateConsistency));
  return 0.7 * mandalaScore + 0.3 * aggregateScore;
}

// Budget per stat in EXP units.
export function computeBudgetForStat({
  statPoints = 1,
  level = 1,
  mandalaStreak = 0,
  aggregateConsistency = 0,
  basePerPoint = 120,
} = {}) {
  const streakFactor = computeStreakFactor({ mandalaStreak, aggregateConsistency });
  const levelFactor = computeLevelFactor(level);
  const multiplier = 1 + 0.7 * streakFactor + 0.3 * levelFactor; // 70% streak, 30% level
  const base = Math.max(1, statPoints) * basePerPoint;
  return base * multiplier;
}

// Budgets for all stats based on raw standExp (no chart-derived inputs).
export function computeDailyBudgets({
  standExp = {},
  level = 1,
  mandalaStreak = 0,
  aggregateConsistency = 0,
  basePerPoint = 120,
  adaptMultipliers = null,
} = {}) {
  const budgets = {};
  STAT_KEYS.forEach((key) => {
    const statPoints = standExpToPoints(standExp?.[key]);
    const baseBudget = computeBudgetForStat({
      statPoints,
      level,
      mandalaStreak,
      aggregateConsistency,
      basePerPoint,
    });
    const adapt = adaptMultipliers?.[key];
    const m =
      typeof adapt === "number" && Number.isFinite(adapt) && adapt > 0 ? adapt : 1;
    budgets[key] = baseBudget * m;
  });
  return budgets;
}

/**
 * Dead-simple progressive overload (Option A):
 * Update "tomorrow multipliers" from today's earned load (post-fatigue).
 *
 * - If you hit/exceed your cap today (ratio >= 1): nudge tomorrow up.
 * - If you under-train heavily (ratio < 0.25): decay tomorrow down a bit.
 * - Otherwise: keep tomorrow the same.
 */
export function updateFatigueAdaptNext({
  adaptNext = {},
  spentTodayAfter = {},
  budgetsToday = {},
  upRatio = 0.9,    // Hit 90% to grow
  downRatio = 0.3,  // <--- CHANGE: Must use 40% to maintain (was 0.25)
  upPct = 0.20,     // <--- CHANGE: Grow by 20% (was 0.03)
  downPct = 0.10,   // <--- CHANGE: Lose 10% if lazy (was 0.01)
  min = 0.5,
  max = 2.0,
} = {}) {
  const next = { ...(adaptNext || {}) };
  STAT_KEYS.forEach((k) => {
    const budget = budgetsToday?.[k] ?? 0;
    if (!(typeof budget === "number" && Number.isFinite(budget) && budget > 0)) return;
    const spent = spentTodayAfter?.[k] ?? 0;
    const s = typeof spent === "number" && Number.isFinite(spent) ? spent : 0;
    const ratio = s / budget;
    const curRaw = next?.[k];
    const cur =
      typeof curRaw === "number" && Number.isFinite(curRaw) && curRaw > 0 ? curRaw : 1;

    if (ratio >= upRatio) {
      next[k] = Math.min(max, cur * (1 + upPct));
      return;
    }
    if (ratio < downRatio) {
      next[k] = Math.max(min, cur * (1 - downPct));
    }
  });
  return next;
}

// Soft damping curve; decays toward floor as spent exceeds budget.
export function dampingMultiplier({ spent = 0, budget = 0, floor = 0.4 } = {}) {
  if (!budget || spent <= budget) return 1;
  const floorClamped = Math.max(0, Math.min(1, floor));
  const excessRatio = Math.max(0, spent / budget - 1); // 0 at budget, 1 at 2x budget
  const decay = Math.exp(-1 * excessRatio); // ~0.37 at 2x budget
  return floorClamped + (1 - floorClamped) * decay;
}
    