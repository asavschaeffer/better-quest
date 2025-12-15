import { STAT_KEYS } from "./models.js";
import { computeDailyBudgets, dampingMultiplier } from "./fatigue.js";
import { playerStatsToChartValues, computeTodayStandExp } from "./stats.js";
import { getMaxMandalaStreak, computeAggregateConsistency } from "./quests.js";

export function applySessionBonuses(session, baseExp) {
  const mult = session.bonusMultiplier ?? 1;
  if (mult === 1) return baseExp;
  const totalExp = Math.round(baseExp.totalExp * mult);
  const standExp = {};
  if (baseExp.standExp) {
    Object.entries(baseExp.standExp).forEach(([key, value]) => {
      const v = typeof value === "number" ? value : 0;
      standExp[key] = Math.round(v * mult);
    });
  }
  return {
    totalExp,
    standExp,
  };
}

export function applyFatigueDamping({ baseExp, avatar, sessions, questStreaks }) {
  if (!baseExp || !baseExp.standExp) return baseExp;
  const todaySpent = computeTodayStandExp(sessions);
  const mandalaStreak = getMaxMandalaStreak(questStreaks);
  const aggregateConsistency = computeAggregateConsistency(sessions);
  const chartStats = playerStatsToChartValues(avatar?.standExp || {});
  const budgets = computeDailyBudgets({
    chartStats,
    level: avatar?.level ?? 1,
    mandalaStreak,
    aggregateConsistency,
  });

  const adjustedStand = {};
  STAT_KEYS.forEach((k) => {
    const gain = baseExp.standExp?.[k] ?? 0;
    const spent = todaySpent[k] ?? 0;
    const budget = budgets[k] ?? 0;
    const mult = dampingMultiplier({
      spent: spent + gain,
      budget,
      floor: 0.4,
    });
    adjustedStand[k] = Math.round(gain * mult);
  });
  const adjustedTotal = Math.max(
    0,
    Math.round(Object.values(adjustedStand).reduce((sum, v) => sum + v, 0)),
  );
  return {
    totalExp: adjustedTotal,
    standExp: adjustedStand,
  };
}
