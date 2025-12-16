import test from "node:test";
import assert from "node:assert/strict";

import { computeDailyBudgets, updateFatigueAdaptNext } from "../core/fatigue.js";

test("computeDailyBudgets applies adaptMultipliers per stat", () => {
  const budgets = computeDailyBudgets({
    chartStats: { STR: 5, DEX: 1, STA: 1, INT: 1, SPI: 1, CRE: 1, VIT: 1 },
    level: 1,
    mandalaStreak: 0,
    aggregateConsistency: 0,
    basePerPoint: 120,
    adaptMultipliers: { STR: 1.5 },
  });
  // STR has higher chart value => higher base budget; multiplier should scale it further.
  assert.ok(budgets.STR > 0);
  const budgetsNoAdapt = computeDailyBudgets({
    chartStats: { STR: 5, DEX: 1, STA: 1, INT: 1, SPI: 1, CRE: 1, VIT: 1 },
    level: 1,
    mandalaStreak: 0,
    aggregateConsistency: 0,
    basePerPoint: 120,
  });
  assert.ok(budgets.STR > budgetsNoAdapt.STR);
  assert.equal(Math.round((budgets.STR / budgetsNoAdapt.STR) * 100) / 100, 1.5);
});

test("updateFatigueAdaptNext nudges up when hitting cap and decays when undertraining", () => {
  const next = updateFatigueAdaptNext({
    adaptNext: { STR: 1, INT: 1 },
    spentTodayAfter: { STR: 100, INT: 10 },
    budgetsToday: { STR: 100, INT: 100 },
    upPct: 0.03,
    downPct: 0.01,
  });
  assert.ok(next.STR > 1);
  assert.ok(next.INT < 1);
});

test("updateFatigueAdaptNext respects min/max caps", () => {
  const up = updateFatigueAdaptNext({
    adaptNext: { STR: 2.0 },
    spentTodayAfter: { STR: 999 },
    budgetsToday: { STR: 100 },
    max: 2.0,
  });
  assert.equal(up.STR, 2.0);

  const down = updateFatigueAdaptNext({
    adaptNext: { STR: 0.8 },
    spentTodayAfter: { STR: 0 },
    budgetsToday: { STR: 100 },
    min: 0.8,
  });
  assert.equal(down.STR, 0.8);
});


