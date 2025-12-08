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
  const avatar = { standExp: { STR: 200, DEX: 10, STA: 10, INT: 5, SPI: 5, CRE: 5, VIT: 5 } };
  const userQuests = [
    { id: "a", label: "Lift", stats: { STR: 3 }, defaultDurationMinutes: 25 },
    { id: "b", label: "Read", stats: { INT: 3 }, defaultDurationMinutes: 25 },
  ];
  const suggestions = computeQuickstartSuggestions(userQuests, avatar);
  assert.equal(suggestions[0].id, "a");
});
