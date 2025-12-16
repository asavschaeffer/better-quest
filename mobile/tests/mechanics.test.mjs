import test from "node:test";
import assert from "node:assert/strict";

import {
  createQuest,
  createTaskSession,
  validateQuestStats,
  QUEST_STAT_MAX_PER_STAT,
} from "../core/models.js";
import { calculateExpForSession } from "../core/exp.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import { dampingMultiplier } from "../core/fatigue.js";
import { playerStatsToChartValues } from "../core/stats.js";
import { questStatsToChartStats } from "../core/questStorage.js";

test("Quest stats validation enforces per-stat cap (no total cap)", () => {
  assert.equal(QUEST_STAT_MAX_PER_STAT, 3);

  const validated = validateQuestStats({ STR: 999, INT: 2, DEX: 2 });
  // Per-stat capped at 3.
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
  assert.equal(q.stats.STR, 3);
  assert.equal(q.stats.INT, 3);
});

test("Base EXP is durationMinutes * 10 (clamped 1..240)", () => {
  const exp = calculateExpForSession({ durationMinutes: 25, allocation: { STA: 3 } });
  assert.equal(exp.totalExp, 250);
});

test("createTaskSession persists allocation/targetStats/endTimeMs (intent snapshot)", () => {
  const allocation = { STR: 2, INT: 1 };
  const targetStats = { STR: 4.2, INT: 2.1 };
  const endTimeMs = Date.now() + 25 * 60 * 1000;
  const s = createTaskSession({
    id: "s1",
    description: "Test",
    durationMinutes: 25,
    allocation,
    targetStats,
    endTimeMs,
  });
  assert.deepEqual(s.allocation, allocation);
  assert.deepEqual(s.targetStats, targetStats);
  assert.equal(s.endTimeMs, endTimeMs);
});

test("Stand EXP distribution uses allocation points (0-3) and conserves total EXP", () => {
  // STR=3, others 0 -> all exp to STR.
  const exp = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 3 } });
  assert.equal(exp.totalExp, 100);
  assert.equal(exp.standExp.STR, 100);
  // Some axis should be 0 if it had no points.
  assert.equal(exp.standExp.INT, 0);
  const sum = Object.values(exp.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, exp.totalExp);
});

test("Allocation is authoritative even if standStats disagree (back-compat only)", () => {
  const exp = calculateExpForSession({
    durationMinutes: 10,
    allocation: { STR: 3 },
    // If used, this would move exp away from STR due to raw-1 weights.
    standStats: { STR: 1, DEX: 6, STA: 6, INT: 6, SPI: 6, CRE: 6, VIT: 6 },
  });
  assert.equal(exp.totalExp, 100);
  assert.equal(exp.standExp.STR, 100);
  const sum = Object.values(exp.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, exp.totalExp);
});

test("applySessionBonuses multiplies and rounds totals and per-axis gains", () => {
  const base = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 3, DEX: 1 } });
  const boosted = applySessionBonuses({ bonusMultiplier: 1.2, allocation: { STR: 3, DEX: 1 } }, base);
  assert.equal(boosted.totalExp, Math.round(base.totalExp * 1.2));
  const sum = Object.values(boosted.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, boosted.totalExp);
});

test("dampingMultiplier returns 1 under budget and decays above budget", () => {
  assert.equal(dampingMultiplier({ spent: 50, budget: 100 }), 1);
  const m = dampingMultiplier({ spent: 200, budget: 100, floor: 0.4 });
  assert.ok(m < 1);
  assert.ok(m > 0.4);
});

test("applyFatigueDamping returns unchanged exp when there is no overspend today", () => {
  const base = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 3 } });
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


