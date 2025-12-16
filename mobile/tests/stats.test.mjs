import test from "node:test";
import assert from "node:assert/strict";
import {
  playerStatsToChartValues,
  addStandExp,
  computeTodayStandExp,
} from "../core/stats.js";

test("playerStatsToChartValues returns 1s for empty stats", () => {
  const chart = playerStatsToChartValues({});
  Object.values(chart).forEach((v) => {
    assert.equal(v, 1);
  });
});

test("playerStatsToChartValues scales highest stat near 6", () => {
  const chart = playerStatsToChartValues({ STR: 1000, DEX: 10, INT: 1 });
  assert.ok(chart.STR > chart.DEX);
  assert.ok(chart.DEX > chart.INT);
  assert.ok(chart.STR <= 6 && chart.STR > 5);
});

test("playerStatsToChartValues overlay can use maxStatOverride to avoid rescaling", () => {
  const base = { STR: 1000, DEX: 500 };
  const baseChart = playerStatsToChartValues(base);
  // Add a big gain to the current max stat; without override, DEX would shrink.
  const preview = { STR: 2000, DEX: 500 };
  const overlay = playerStatsToChartValues(preview, { maxStatOverride: 1000 });
  assert.equal(overlay.STR, 6, "max stat should cap at S (6) under override");
  assert.equal(
    overlay.DEX,
    baseChart.DEX,
    "non-max axes should not shrink when overlay uses baseline max scale",
  );
});

test("addStandExp sums deltas safely", () => {
  const next = addStandExp({ STR: 1, DEX: 2 }, { STR: 3, STA: 4 });
  assert.equal(next.STR, 4);
  assert.equal(next.DEX, 2);
  assert.equal(next.STA, 4);
});

test("computeTodayStandExp sums only today's gains", () => {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sessions = [
    { completedAt: today.toISOString(), expResult: { standExp: { STR: 10 } } },
    { completedAt: yesterday.toISOString(), expResult: { standExp: { STR: 5 } } },
  ];
  const totals = computeTodayStandExp(sessions);
  assert.equal(totals.STR, 10);
});
