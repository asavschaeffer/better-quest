import test from "node:test";
import assert from "node:assert/strict";

import {
  createQuest,
  validateQuestStats,
  QUEST_STAT_MAX_PER_STAT,
  QUEST_STAT_MAX_TOTAL,
} from "../core/models.js";
import { calculateExpForSession } from "../core/exp.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import { dampingMultiplier } from "../core/fatigue.js";
import { playerStatsToChartValues } from "../core/stats.js";
import { questStatsToChartStats } from "../core/questStorage.js";

test("Quest stats validation enforces per-stat cap and total cap", () => {
  assert.equal(QUEST_STAT_MAX_PER_STAT, 3);
  assert.equal(QUEST_STAT_MAX_TOTAL, 4);

  const validated = validateQuestStats({ STR: 999, INT: 2, DEX: 2 });
  // Per-stat capped at 3, total capped at 4.
  const total = Object.values(validated).reduce((s, v) => s + v, 0);
  assert.ok(total <= 4);
  assert.ok(validated.STR <= 3);
});

test("createQuest clamps duration and validates required fields", () => {
  const q = createQuest({
    id: "q1",
    label: "Test",
    defaultDurationMinutes: 999,
    stats: { STR: 3, INT: 3 },
  });
  assert.equal(q.defaultDurationMinutes, 240);
  const total = Object.values(q.stats).reduce((s, v) => s + v, 0);
  assert.ok(total <= 4);
});

test("Base EXP is durationMinutes * 10 (clamped 1..240)", () => {
  const exp = calculateExpForSession({ durationMinutes: 25, standStats: { STR: 6, INT: 1 } });
  assert.equal(exp.totalExp, 250);
});

test("Stand EXP distribution uses standStats weights (raw-1) and rounds per axis", () => {
  // STR=6 => weight 5, INT=1 => weight 0, others default 0 -> all exp to STR.
  const exp = calculateExpForSession({ durationMinutes: 10, standStats: { STR: 6, INT: 1 } });
  assert.equal(exp.totalExp, 100);
  assert.equal(exp.standExp.STR, 100);
  // Some axis should be 0 if it had no weight.
  assert.equal(exp.standExp.INT, 0);
});

test("applySessionBonuses multiplies and rounds totals and per-axis gains", () => {
  const base = calculateExpForSession({ durationMinutes: 10, standStats: { STR: 6 } });
  const boosted = applySessionBonuses({ bonusMultiplier: 1.2 }, base);
  assert.equal(boosted.totalExp, Math.round(base.totalExp * 1.2));
  assert.equal(boosted.standExp.STR, Math.round(base.standExp.STR * 1.2));
});

test("dampingMultiplier returns 1 under budget and decays above budget", () => {
  assert.equal(dampingMultiplier({ spent: 50, budget: 100 }), 1);
  const m = dampingMultiplier({ spent: 200, budget: 100, floor: 0.4 });
  assert.ok(m < 1);
  assert.ok(m > 0.4);
});

test("applyFatigueDamping returns unchanged exp when there is no overspend today", () => {
  const base = calculateExpForSession({ durationMinutes: 10, standStats: { STR: 6 } });
  const damped = applyFatigueDamping({
    baseExp: base,
    avatar: { level: 1, standExp: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 } },
    sessions: [],
    questStreaks: {},
  });
  assert.deepEqual(damped, base);
});

test("playerStatsToChartValues uses E..S scale (1..6) and max axis maps near 6", () => {
  const chart = playerStatsToChartValues({ STR: 1000, DEX: 10, INT: 1 });
  assert.ok(chart.STR > chart.DEX);
  assert.ok(chart.DEX > chart.INT);
  assert.ok(chart.STR <= 6 && chart.STR > 5);
});

test("questStatsToChartStats maps allocation+duration onto E..S scale (1..6)", () => {
  const stats = { STR: 3, INT: 0 };
  const base = questStatsToChartStats(stats, 0);
  assert.equal(base.INT, 1);
  const target = questStatsToChartStats(stats, 120);
  assert.equal(target.STR, 6);
});


