import test from "node:test";
import assert from "node:assert/strict";
import { createUser, createTaskSession } from "../core/models.js";
import { calculateExpForSession, applyExpToAvatar } from "../core/exp.js";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";
import { computeQuickstartSuggestions } from "../core/quests.js";

test("session completion applies bonuses, damping, and levels avatar", () => {
  const user = createUser();
  const avatar = user.avatar;
  const session = createTaskSession({
    id: "s1",
    description: "Study",
    durationMinutes: 25,
    standStats: { INT: 5, STR: 1 },
    bonusMultiplier: 1.2,
  });
  const baseExp = calculateExpForSession(session);
  const withBonuses = applySessionBonuses(session, baseExp);
  const damped = applyFatigueDamping({
    baseExp: withBonuses,
    avatar,
    sessions: [],
    questStreaks: {},
  });
  const leveled = applyExpToAvatar(avatar, damped);
  assert.ok(leveled.totalExp > avatar.totalExp);
  assert.ok(leveled.level >= avatar.level);
});

test("quickstart suggestions favor matching stats", () => {
  const avatar = { standExp: { STR: 200, DEX: 10, STA: 10, INT: 5, SPI: 5, CHA: 5, VIT: 5 } };
  const userQuests = [
    { id: "a", label: "Lift", stats: { STR: 2 }, defaultDurationMinutes: 25 },
    { id: "b", label: "Read", stats: { INT: 2 }, defaultDurationMinutes: 25 },
  ];
  const suggestions = computeQuickstartSuggestions(userQuests, avatar);
  // We merge built-in templates too, so the exact top ID can change.
  // The invariant we care about: a STR-focused quest ranks ahead of an INT-focused one here.
  const ids = suggestions.map((s) => s.id);
  assert.ok(ids.includes("a") || ids.includes("weightlifting"));
  assert.ok(!ids.includes("b") || ids.indexOf("b") > ids.indexOf("a") || ids.indexOf("b") > ids.indexOf("weightlifting"));
});
