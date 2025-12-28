import test from "node:test";
import assert from "node:assert/strict";
import {
  rankQuests,
  computeStreakDays,
  updateQuestStreaks,
  getMaxMandalaStreak,
  computeAggregateConsistency,
} from "../core/quests.js";

test("rankQuests orders by focus match", () => {
  const templates = [
    { id: "a", label: "Strength", stats: { STR: 2 } },
    { id: "b", label: "Mind", stats: { INT: 2 } },
  ];
  const ranked = rankQuests(templates, { STR: 5, INT: 1 }, "");
  assert.equal(ranked[0].id, "a");
});

test("computeStreakDays counts consecutive days", () => {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sessions = [
    { completedAt: today.toISOString() },
    { completedAt: yesterday.toISOString() },
  ];
  assert.equal(computeStreakDays(sessions), 2);
});

test("updateQuestStreaks increments by day", () => {
  const today = new Date().toISOString();
  const streaks = updateQuestStreaks({}, "quest-1", today);
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const next = updateQuestStreaks(streaks, "quest-1", tomorrow);
  assert.equal(next["quest-1"].streak, 2);
});

test("getMaxMandalaStreak returns highest streak", () => {
  const max = getMaxMandalaStreak({
    a: { streak: 2 },
    b: { streak: 5 },
    c: { streak: 1 },
  });
  assert.equal(max, 5);
});

test("computeAggregateConsistency blends week/month activity", () => {
  const today = new Date();
  const sessions = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    sessions.push({ completedAt: d.toISOString() });
  }
  const ratio = computeAggregateConsistency(sessions);
  assert.ok(ratio > 0);
});
