import test from "node:test";
import assert from "node:assert/strict";
import { buildLogText } from "../core/logs.js";

const mockSessions = [
  {
    description: "Study",
    durationMinutes: 30,
    expResult: { totalExp: 300 },
    completedAt: "2025-01-01",
  },
];

test("buildLogText returns raw format by default", () => {
  const text = buildLogText("raw", mockSessions);
  assert.ok(text.includes("Study"));
});

test("buildLogText supports twitter style", () => {
  const text = buildLogText("twitter", mockSessions);
  assert.ok(text.includes("focused work"));
});
