import test from "node:test";
import assert from "node:assert/strict";

import {
  parseHHMM,
  getSunriseAtLocalMs,
  isWithinBrahmaWindow,
  applyBrahmaMuhurtaBonus,
  computeStreakBonusEntries,
  resolveBonusMultiplier,
} from "../core/bonuses.js";
import { calculateExpForSession } from "../core/exp.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";

test("parseHHMM accepts HH:MM and normalizes bounds", () => {
  assert.deepEqual(parseHHMM("06:30"), { hours: 6, minutes: 30 });
  assert.deepEqual(parseHHMM("6:30"), { hours: 6, minutes: 30 });
  assert.equal(parseHHMM("24:00"), null);
  assert.equal(parseHHMM("06:60"), null);
  assert.equal(parseHHMM("nope"), null);
});

test("Brahma window check works relative to sunrise time", () => {
  const ref = new Date("2025-01-01T06:00:00").getTime(); // local parse
  const sunrise = getSunriseAtLocalMs({ referenceTimeMs: ref, sunriseTimeLocal: "06:30" });
  assert.ok(Number.isFinite(sunrise));

  const inside = sunrise - 60 * 60 * 1000; // 60 min before sunrise (between 96 and 48)
  const outside = sunrise - 10 * 60 * 1000; // 10 min before sunrise
  assert.equal(isWithinBrahmaWindow({ endTimeMs: inside, sunriseAtLocalMs: sunrise }), true);
  assert.equal(isWithinBrahmaWindow({ endTimeMs: outside, sunriseAtLocalMs: sunrise }), false);
});

test("Brahma window boundaries are inclusive at start/end", () => {
  const ref = new Date("2025-01-01T06:00:00").getTime();
  const sunrise = getSunriseAtLocalMs({ referenceTimeMs: ref, sunriseTimeLocal: "06:30" });
  assert.ok(Number.isFinite(sunrise));
  const windowStart = sunrise - 96 * 60 * 1000;
  const windowEnd = sunrise - 48 * 60 * 1000;
  assert.equal(isWithinBrahmaWindow({ endTimeMs: windowStart, sunriseAtLocalMs: sunrise }), true);
  assert.equal(isWithinBrahmaWindow({ endTimeMs: windowEnd, sunriseAtLocalMs: sunrise }), true);
});

test("applyBrahmaMuhurtaBonus doubles SPI gains and increases total when eligible", () => {
  const endTime = new Date();
  endTime.setHours(5, 30, 0, 0);
  const endTimeMs = endTime.getTime();
  const session = { allocation: { SPI: 1 }, endTimeMs };
  const exp = { totalExp: 10, standExp: { SPI: 4, STR: 6 } };
  // With sunrise 06:30, 05:30 is inside (96..48) window.
  const out = applyBrahmaMuhurtaBonus({ session, exp, sunriseTimeLocal: "06:30" });
  assert.equal(out.applied, true);
  assert.equal(out.exp.standExp.SPI, 8);
  assert.equal(out.exp.totalExp, 14);
  assert.ok(out.breakdownEntry);
});

test("applyBrahmaMuhurtaBonus falls back to default sunriseTimeLocal if invalid", () => {
  const endTime = new Date();
  endTime.setHours(5, 30, 0, 0);
  const out = applyBrahmaMuhurtaBonus({
    session: { allocation: { SPI: 1 }, endTimeMs: endTime.getTime() },
    exp: { totalExp: 10, standExp: { SPI: 4, STR: 6 } },
    sunriseTimeLocal: "not-a-time",
  });
  assert.equal(out.applied, true);
});

test("streak bonuses start on day 2 (global) and day 2 for same quest (mandala)", () => {
  const now = Date.now();
  const yesterday = new Date(now - 86400000).toISOString();
  const today = new Date(now).toISOString();

  // Day 1: only today's completion exists -> no bonuses.
  const day1 = computeStreakBonusEntries({
    sessions: [],
    questStreaks: {},
    questKey: "meditation",
    completedAt: today,
  });
  assert.equal(day1.entries.length, 0);

  // Day 2 global: we have an existing session yesterday + completion today.
  const day2 = computeStreakBonusEntries({
    sessions: [{ completedAt: yesterday }],
    questStreaks: { meditation: { lastDay: yesterday, streak: 1 } },
    questKey: "meditation",
    completedAt: today,
  });
  const keys = day2.entries.map((e) => e.key).sort();
  assert.deepEqual(keys, ["global_streak", "mandala_streak"]);

  const mult = resolveBonusMultiplier({
    bonusBreakdown: day2.entries,
    fallbackMultiplier: 1,
  });
  // global +20% and mandala day2 +10% => 1.3x
  assert.equal(mult, 1.3);
});

test("streak bonuses reset after a missed day (global + mandala)", () => {
  const now = Date.now();
  const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
  const today = new Date(now).toISOString();

  // Global: missing yesterday means streak should be 1 (no bonus).
  const global = computeStreakBonusEntries({
    sessions: [{ completedAt: twoDaysAgo }],
    questStreaks: {},
    questKey: "meditation",
    completedAt: today,
  });
  assert.equal(global.entries.some((e) => e.key === "global_streak"), false);

  // Mandala: previous quest streak existed but lastDay is not yesterday -> resets to 1 (no bonus).
  const mandala = computeStreakBonusEntries({
    sessions: [{ completedAt: twoDaysAgo }],
    questStreaks: { meditation: { lastDay: twoDaysAgo, streak: 7 } },
    questKey: "meditation",
    completedAt: today,
  });
  assert.equal(mandala.entries.some((e) => e.key === "mandala_streak"), false);
});

test("resolveBonusMultiplier combines mult and add bonuses deterministically", () => {
  const m = resolveBonusMultiplier({
    bonusBreakdown: [
      { key: "combo", mode: "mult", value: 1.2 },
      { key: "rest", mode: "mult", value: 1.1 },
      { key: "global_streak", mode: "add", value: 0.2 },
      { key: "mandala_streak", mode: "add", value: 0.1 },
    ],
    fallbackMultiplier: 1,
  });
  // (1.2*1.1) * (1 + 0.2 + 0.1) = 1.32 * 1.3 = 1.716
  assert.ok(Math.abs(m - 1.716) < 1e-9);
});

test("integration: completion pipeline preserves invariants and includes expected bonus keys", () => {
  const now = Date.now();
  const yesterday = new Date(now - 86400000).toISOString();
  const endTime = new Date(now);
  endTime.setHours(5, 30, 0, 0); // inside Brahma window for sunrise 06:30
  const endTimeMs = endTime.getTime();
  const completedAt = endTime.toISOString();

  const session = {
    id: "s-integration",
    description: "Meditation",
    durationMinutes: 25,
    allocation: { SPI: 3, VIT: 1 },
    questKey: "meditation",
    endTimeMs,
    endTime: completedAt,
    // include a multiplicative bonus (combo) to verify mixed stacking
    bonusBreakdown: [{ key: "combo", label: "Combo", mode: "mult", value: 1.2 }],
    bonusMultiplier: 1.2,
  };

  const { entries: streakEntries } = computeStreakBonusEntries({
    sessions: [{ completedAt: yesterday }],
    questStreaks: { meditation: { lastDay: yesterday, streak: 1 } },
    questKey: session.questKey,
    completedAt,
  });
  session.bonusBreakdown = [...session.bonusBreakdown, ...streakEntries];
  session.bonusMultiplier = resolveBonusMultiplier({
    bonusBreakdown: session.bonusBreakdown,
    fallbackMultiplier: session.bonusMultiplier,
  });

  const base = calculateExpForSession(session);
  const withBonuses = applySessionBonuses(session, base);
  const brahma = applyBrahmaMuhurtaBonus({
    session,
    exp: withBonuses,
    sunriseTimeLocal: "06:30",
  });
  const final = applyFatigueDamping({
    baseExp: brahma.exp,
    avatar: { level: 1, standExp: { STR: 0, DEX: 0, STA: 0, INT: 0, SPI: 0, CHA: 0, VIT: 0 } },
    sessions: [],
    questStreaks: {},
  });

  const sum = Object.values(final.standExp).reduce((s, v) => s + v, 0);
  assert.equal(sum, final.totalExp);

  const keys = session.bonusBreakdown.map((b) => b.key);
  assert.ok(keys.includes("combo"));
  assert.ok(keys.includes("global_streak"));
  assert.ok(keys.includes("mandala_streak"));
  assert.equal(brahma.applied, true);
});


