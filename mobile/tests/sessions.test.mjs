import test from "node:test";
import assert from "node:assert/strict";
import { applySessionBonuses, applyFatigueDamping } from "../core/sessions.js";

test("applySessionBonuses multiplies totals and stand exp", () => {
  const base = { totalExp: 100, standExp: { STR: 50, INT: 50 } };
  const session = { bonusMultiplier: 1.2 };
  const result = applySessionBonuses(session, base);
  assert.equal(result.totalExp, 120);
  assert.equal(result.standExp.STR, 60);
});

test("applyFatigueDamping reduces gains when over budget", () => {
  const baseExp = { totalExp: 200, standExp: { STR: 200 } };
  const avatar = { standExp: { STR: 10 }, level: 1 };
  const sessions = [
    { completedAt: new Date().toISOString(), expResult: { standExp: { STR: 500 } } },
  ];
  const questStreaks = {};
  const damped = applyFatigueDamping({ baseExp, avatar, sessions, questStreaks });
  assert.ok(damped.totalExp <= baseExp.totalExp);
  assert.ok(damped.standExp.STR <= baseExp.standExp.STR);
});
