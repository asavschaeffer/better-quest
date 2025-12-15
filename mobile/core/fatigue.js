import { STAT_KEYS } from "./models.js";

// Map chart stat value (1–5) to quest-like points (1–3) for budgeting.
export function chartValueToPoints(value) {
  const clamped = Math.max(1, Math.min(5, typeof value === "number" ? value : 1));
  const scaled = ((clamped - 1) / 4) * 3; // map 1-5 to 0-3
  return Math.max(1, Math.round(scaled)); // keep at least 1 point for momentum
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

// Budgets for all stats based on current chart values.
export function computeDailyBudgets({
  chartStats = {},
  level = 1,
  mandalaStreak = 0,
  aggregateConsistency = 0,
  basePerPoint = 120,
} = {}) {
  const budgets = {};
  STAT_KEYS.forEach((key) => {
    const statPoints = chartValueToPoints(chartStats[key]);
    budgets[key] = computeBudgetForStat({
      statPoints,
      level,
      mandalaStreak,
      aggregateConsistency,
      basePerPoint,
    });
  });
  return budgets;
}

// Soft damping curve; decays toward floor as spent exceeds budget.
export function dampingMultiplier({ spent = 0, budget = 0, floor = 0.4 } = {}) {
  if (!budget || spent <= budget) return 1;
  const floorClamped = Math.max(0, Math.min(1, floor));
  const excessRatio = Math.max(0, spent / budget - 1); // 0 at budget, 1 at 2x budget
  const decay = Math.exp(-1 * excessRatio); // ~0.37 at 2x budget
  return floorClamped + (1 - floorClamped) * decay;
}
    