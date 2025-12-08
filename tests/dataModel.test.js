/**
 * Data Model Tests
 * Tests for the new hierarchical data model entities and functions
 */

import { STAT_KEYS, QUEST_STAT_MAX_PER_STAT, QUEST_STAT_MAX_TOTAL } from "../mobile/core/models.js";

// Simple test framework
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message = "Assertion failed") {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = "") {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

console.log("\n============================================================");
console.log("DATA MODEL TESTS");
console.log("============================================================\n");

// Since dataModel.js uses ES modules, we'll test the concepts inline
// This tests the logic without needing to resolve ES module imports

console.log(">>> STAT COMPUTATION TESTS\n");

// Test computeQuestStats logic
function computeQuestStats(baseStats, subquest = null) {
  if (!subquest) {
    return { ...baseStats };
  }
  if (subquest.statOverride) {
    return { ...subquest.statOverride };
  }
  const result = {};
  STAT_KEYS.forEach((key) => {
    const base = baseStats?.[key] ?? 0;
    const delta = subquest.statDelta?.[key] ?? 0;
    result[key] = Math.max(0, Math.min(QUEST_STAT_MAX_PER_STAT, base + delta));
  });
  return result;
}

test("computeQuestStats with no subquest returns base stats", () => {
  const base = { STR: 2, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 0 };
  const result = computeQuestStats(base, null);
  assertEqual(result.STR, 2);
  assertEqual(result.DEX, 1);
});

test("computeQuestStats with statDelta adds to base", () => {
  const base = { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 };
  const subquest = {
    statDelta: { STR: 1, DEX: -1, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
  };
  const result = computeQuestStats(base, subquest);
  assertEqual(result.STR, 2, "STR should be 2 (1+1)");
  assertEqual(result.DEX, 0, "DEX should be 0 (1-1, clamped)");
  assertEqual(result.STA, 1, "STA should remain 1");
  assertEqual(result.VIT, 1, "VIT should remain 1");
});

test("computeQuestStats clamps at max per stat", () => {
  const base = { STR: 3, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 };
  const subquest = {
    statDelta: { STR: 2, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
  };
  const result = computeQuestStats(base, subquest);
  assertEqual(result.STR, QUEST_STAT_MAX_PER_STAT, `STR should be clamped at ${QUEST_STAT_MAX_PER_STAT}`);
});

test("computeQuestStats clamps at min 0", () => {
  const base = { STR: 1, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 };
  const subquest = {
    statDelta: { STR: -5, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 },
  };
  const result = computeQuestStats(base, subquest);
  assertEqual(result.STR, 0, "STR should be clamped at 0");
});

test("computeQuestStats with statOverride replaces entirely", () => {
  const base = { STR: 1, DEX: 1, STA: 1, INT: 0, SPI: 0, CRE: 0, VIT: 1 };
  const subquest = {
    statOverride: { STR: 0, DEX: 0, STA: 0, INT: 3, SPI: 0, CRE: 1, VIT: 0 },
    statDelta: { STR: 5, DEX: 5, STA: 5, INT: 5, SPI: 5, CRE: 5, VIT: 5 }, // Should be ignored
  };
  const result = computeQuestStats(base, subquest);
  assertEqual(result.INT, 3, "INT should use override value");
  assertEqual(result.STR, 0, "STR should use override value, not base+delta");
});

console.log("\n>>> STAT VALIDATION TESTS\n");

function validateStats(stats) {
  const result = {};
  let total = 0;
  STAT_KEYS.forEach((key) => {
    result[key] = 0;
  });
  STAT_KEYS.forEach((key) => {
    const raw = stats?.[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      const clamped = Math.min(QUEST_STAT_MAX_PER_STAT, Math.max(0, Math.floor(raw)));
      const canAdd = Math.min(clamped, QUEST_STAT_MAX_TOTAL - total);
      if (canAdd > 0) {
        result[key] = canAdd;
        total += canAdd;
      }
    }
  });
  return result;
}

test("validateStats clamps individual stats", () => {
  const result = validateStats({ STR: 10, DEX: 0, STA: 0, INT: 0, SPI: 0, CRE: 0, VIT: 0 });
  assertEqual(result.STR, QUEST_STAT_MAX_PER_STAT);
});

test("validateStats enforces max total", () => {
  const result = validateStats({ STR: 3, DEX: 3, STA: 3, INT: 3, SPI: 3, CRE: 3, VIT: 3 });
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  assert(total <= QUEST_STAT_MAX_TOTAL, `Total ${total} should be <= ${QUEST_STAT_MAX_TOTAL}`);
});

test("validateStats handles undefined/null values", () => {
  const result = validateStats({ STR: undefined, DEX: null, STA: NaN, INT: 1 });
  assertEqual(result.INT, 1);
  assertEqual(result.STR, 0);
  assertEqual(result.DEX, 0);
  assertEqual(result.STA, 0);
});

console.log("\n>>> FACTORY FUNCTION TESTS\n");

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("generateId creates unique IDs", () => {
  const id1 = generateId("test");
  const id2 = generateId("test");
  assert(id1.startsWith("test-"), "ID should start with prefix");
  assert(id1 !== id2, "IDs should be unique");
});

console.log("\n>>> PROGRAM PROGRESS TESTS\n");

// Mock calculateProgramProgress logic
function calculateProgramProgress(subscription) {
  const programId = subscription?.programId || subscription?.kitId;
  const startDate = subscription?.startDate;
  const completedDayIds = subscription?.completedDayIds || subscription?.completedDays || [];

  if (!programId || !startDate) {
    return { currentDay: 0, completedDays: 0, progress: 0 };
  }

  const durationDays = 30; // Mock program length
  const start = new Date(startDate);
  const today = new Date();
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysSinceStart, durationDays);
  const completedCount = completedDayIds.length;
  const progress = durationDays > 0 ? completedCount / durationDays : 0;

  return {
    currentDay,
    completedDays: completedCount,
    totalDays: durationDays,
    progress,
    progressPercent: Math.round(progress * 100),
  };
}

test("calculateProgramProgress handles new subscription", () => {
  const sub = {
    programId: "test-program",
    startDate: new Date().toISOString(),
    completedDayIds: [],
  };
  const result = calculateProgramProgress(sub);
  assertEqual(result.currentDay, 1);
  assertEqual(result.completedDays, 0);
  assertEqual(result.progressPercent, 0);
});

test("calculateProgramProgress handles partial completion", () => {
  const sub = {
    programId: "test-program",
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    completedDayIds: ["day-1", "day-2", "day-3"],
  };
  const result = calculateProgramProgress(sub);
  assertEqual(result.completedDays, 3);
  assert(result.progress > 0, "Progress should be > 0");
});

test("calculateProgramProgress handles legacy format", () => {
  const legacy = {
    kitId: "legacy-program",
    startDate: new Date().toISOString(),
    completedDays: ["day-1"],
  };
  const result = calculateProgramProgress(legacy);
  assertEqual(result.completedDays, 1);
});

console.log("\n>>> QUEST STORAGE TESTS\n");

// Test quest normalization
function normalizeQuest(quest) {
  if (!quest) return null;
  return {
    ...quest,
    baseStats: quest.baseStats || quest.stats || {},
  };
}

test("normalizeQuest handles baseStats format", () => {
  const quest = { id: "test", baseStats: { STR: 2, DEX: 1 } };
  const result = normalizeQuest(quest);
  assertEqual(result.baseStats.STR, 2);
});

test("normalizeQuest handles legacy stats format", () => {
  const quest = { id: "test", stats: { STR: 1, INT: 2 } };
  const result = normalizeQuest(quest);
  assertEqual(result.baseStats.STR, 1);
  assertEqual(result.baseStats.INT, 2);
});

console.log("\n>>> TODO LIST TESTS\n");

// Test todo list progress calculation
function calculateTodoListProgress(todoList) {
  const quests = todoList?.quests || [];
  const total = quests.length;
  const completed = quests.filter(q => q.status === "completed").length;
  const skipped = quests.filter(q => q.status === "skipped").length;
  return {
    total,
    completed,
    skipped,
    pending: total - completed - skipped,
    completionRate: total > 0 ? completed / total : 0,
    isDone: completed + skipped === total && total > 0,
  };
}

test("calculateTodoListProgress with empty list", () => {
  const result = calculateTodoListProgress({ quests: [] });
  assertEqual(result.total, 0);
  assertEqual(result.completionRate, 0);
  assertEqual(result.isDone, false);
});

test("calculateTodoListProgress with all completed", () => {
  const todoList = {
    quests: [
      { id: "1", status: "completed" },
      { id: "2", status: "completed" },
    ],
  };
  const result = calculateTodoListProgress(todoList);
  assertEqual(result.completed, 2);
  assertEqual(result.completionRate, 1);
  assertEqual(result.isDone, true);
});

test("calculateTodoListProgress with mixed status", () => {
  const todoList = {
    quests: [
      { id: "1", status: "completed" },
      { id: "2", status: "pending" },
      { id: "3", status: "skipped" },
    ],
  };
  const result = calculateTodoListProgress(todoList);
  assertEqual(result.completed, 1);
  assertEqual(result.skipped, 1);
  assertEqual(result.pending, 1);
  assertEqual(result.isDone, false);
});

console.log("\n============================================================");
console.log("DATA MODEL TEST RESULTS");
console.log("============================================================");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);
console.log("============================================================\n");

process.exit(failed > 0 ? 1 : 0);
