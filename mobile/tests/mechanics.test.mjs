import test from "node:test";
import assert from "node:assert/strict";

import {
  createQuest,
  createTaskSession,
  validateQuestStats,
  QUEST_STAT_MAX_PER_STAT,
} from "../core/models.js";
import {
  calculateExpForSession,
  getLevelForTotalExp,
  getTotalExpForLevel,
} from "../core/exp.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import { dampingMultiplier } from "../core/fatigue.js";
import { playerStatsToChartValues } from "../core/stats.js";
import { questStatsToChartStats } from "../core/questStorage.js";

test("Quest stats validation enforces per-stat cap", () => {
  assert.equal(QUEST_STAT_MAX_PER_STAT, 2);

  const validated = validateQuestStats({ STR: 999, INT: 2, DEX: 2 });
  // Per-stat capped at 2.
  assert.ok(validated.STR <= 2);
});

test("createQuest clamps duration and validates required fields", () => {
  const q = createQuest({
    id: "q1",
    label: "Test",
    defaultDurationMinutes: 999,
    stats: { STR: 2, INT: 2 },
  });
  assert.equal(q.defaultDurationMinutes, 240);
  assert.equal(q.stats.STR, 2);
  assert.equal(q.stats.INT, 2);
});

test("Base EXP is durationMinutes * 1 (clamped 1..240)", () => {
  const exp = calculateExpForSession({ durationMinutes: 25, allocation: { STA: 2 } });
  assert.equal(exp.totalExp, 25);
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

test("Stand EXP distribution uses allocation points (0-2) and conserves total EXP", () => {
  // STR=2, others 0 -> all exp to STR.
  const exp = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 2 } });
  assert.equal(exp.totalExp, 10);
  assert.equal(exp.standExp.STR, 10);
  // Some axis should be 0 if it had no points.
  assert.equal(exp.standExp.INT, 0);
  const sum = Object.values(exp.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, exp.totalExp);
});

test("Level curve: fast early, slows later, caps at 999 (asymptotic)", () => {
  // Fast early progression (with EXP_PER_MINUTE=1, these are minutes of work).
  assert.equal(getLevelForTotalExp(0), 1);
  assert.equal(getLevelForTotalExp(25), 2);
  assert.equal(getLevelForTotalExp(100), 5);
  assert.equal(getLevelForTotalExp(200), 10);
  assert.equal(getLevelForTotalExp(1000), 45);

  // Monotonic: more EXP never reduces level.
  const a = getLevelForTotalExp(1234);
  const b = getLevelForTotalExp(1235);
  assert.ok(b >= a);

  // Hard cap.
  assert.equal(getLevelForTotalExp(1e12), 999);
});

test("getTotalExpForLevel is monotonic and inverts getLevelForTotalExp (within flooring)", () => {
  // For any level L, exp below the floor stays below L; exp at/above reaches >= L.
  for (const L of [1, 2, 5, 10, 50, 200, 998]) {
    const req = getTotalExpForLevel(L);
    assert.ok(typeof req === "number");
    assert.ok(Number.isFinite(req));
    const below = req - 1;
    assert.ok(getLevelForTotalExp(Math.max(0, below)) <= L);
    assert.ok(getLevelForTotalExp(req) >= L);
  }

  // Top level is asymptotic (unreachable threshold).
  assert.equal(getTotalExpForLevel(999), Number.POSITIVE_INFINITY);
});

test("Intended v1: Quest total allocation is capped at 9 points (rejects > 9)", () => {
  assert.throws(() => {
    createQuest({
      id: "q-too-many",
      label: "Too many points",
      defaultDurationMinutes: 25,
      // Total = 10 (should be rejected in Intended v1)
      stats: { STR: 2, DEX: 2, STA: 2, INT: 2, SPI: 2 },
    });
  });
});

test("Allocation is authoritative even if standStats disagree (back-compat only)", () => {
  const exp = calculateExpForSession({
    durationMinutes: 10,
    allocation: { STR: 2 },
    // If used, this would move exp away from STR due to raw-1 weights.
    standStats: { STR: 1, DEX: 6, STA: 6, INT: 6, SPI: 6, CHA: 6, VIT: 6 },
  });
  assert.equal(exp.totalExp, 10);
  assert.equal(exp.standExp.STR, 10);
  const sum = Object.values(exp.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, exp.totalExp);
});

test("applySessionBonuses multiplies and rounds totals and per-axis gains", () => {
  const base = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 2, DEX: 1 } });
  const boosted = applySessionBonuses({ bonusMultiplier: 1.2, allocation: { STR: 2, DEX: 1 } }, base);
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
  const base = calculateExpForSession({ durationMinutes: 10, allocation: { STR: 2 } });
  const damped = applyFatigueDamping({
    baseExp: base,
    avatar: { level: 1, standExp: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 0 } },
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
  const stats = { STR: 2, INT: 0 };
  const base = questStatsToChartStats(stats, 0);
  assert.equal(base.INT, 1);
  const target = questStatsToChartStats(stats, 120);
  assert.equal(target.STR, 6);
});


