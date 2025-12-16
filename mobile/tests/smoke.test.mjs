import test from "node:test";
import assert from "node:assert/strict";

// Smoke tests verify that modules can be imported without errors
// and that basic exports are present.

test("core models exports required functions", async () => {
  const models = await import("../core/models.js");
  assert.ok(typeof models.createUser === "function", "createUser should be a function");
  assert.ok(typeof models.createTaskSession === "function", "createTaskSession should be a function");
  assert.ok(typeof models.createDefaultAvatar === "function", "createDefaultAvatar should be a function");
  assert.ok(typeof models.createQuest === "function", "createQuest should be a function");
  assert.ok(Array.isArray(models.STAT_KEYS), "STAT_KEYS should be an array");
});

test("core exp exports required functions", async () => {
  const exp = await import("../core/exp.js");
  assert.ok(typeof exp.calculateExpForSession === "function", "calculateExpForSession should be a function");
  assert.ok(typeof exp.applyExpToAvatar === "function", "applyExpToAvatar should be a function");
  assert.ok(typeof exp.getLevelProgress === "function", "getLevelProgress should be a function");
});

test("core questStorage exports required functions", async () => {
  const storage = await import("../core/questStorage.js");
  assert.ok(typeof storage.loadUserQuests === "function", "loadUserQuests should be a function");
  assert.ok(typeof storage.addUserQuest === "function", "addUserQuest should be a function");
  assert.ok(typeof storage.deleteUserQuest === "function", "deleteUserQuest should be a function");
  assert.ok(typeof storage.questStatsToChartStats === "function", "questStatsToChartStats should be a function");
  assert.ok(Array.isArray(storage.BUILT_IN_QUEST_TEMPLATES), "BUILT_IN_QUEST_TEMPLATES should be an array");
});

test("core stats exports required functions", async () => {
  const stats = await import("../core/stats.js");
  assert.ok(typeof stats.playerStatsToChartValues === "function", "playerStatsToChartValues should be a function");
  assert.ok(typeof stats.computeTodayStandExp === "function", "computeTodayStandExp should be a function");
  assert.ok(typeof stats.addStandExp === "function", "addStandExp should be a function");
  assert.ok(typeof stats.aggregateStandGains === "function", "aggregateStandGains should be a function");
});

test("core quests exports required functions", async () => {
  const quests = await import("../core/quests.js");
  assert.ok(typeof quests.computeQuickstartSuggestions === "function", "computeQuickstartSuggestions should be a function");
  assert.ok(typeof quests.updateQuestStreaks === "function", "updateQuestStreaks should be a function");
  assert.ok(typeof quests.rankQuests === "function", "rankQuests should be a function");
  assert.ok(typeof quests.computeStreakDays === "function", "computeStreakDays should be a function");
});

test("core sessions exports required functions", async () => {
  const sessions = await import("../core/sessions.js");
  assert.ok(typeof sessions.applySessionBonuses === "function", "applySessionBonuses should be a function");
  assert.ok(typeof sessions.applyFatigueDamping === "function", "applyFatigueDamping should be a function");
});

test("core fatigue exports required functions", async () => {
  const fatigue = await import("../core/fatigue.js");
  assert.ok(typeof fatigue.computeDailyBudgets === "function", "computeDailyBudgets should be a function");
});

test("createUser returns valid user structure", async () => {
  const { createUser } = await import("../core/models.js");
  const user = createUser();
  assert.ok(user.id, "user should have an id");
  assert.ok(user.avatar, "user should have an avatar");
  assert.ok(typeof user.avatar.name === "string", "avatar should have a name");
  assert.ok(typeof user.avatar.level === "number", "avatar should have a level");
  assert.ok(typeof user.avatar.totalExp === "number", "avatar should have totalExp");
});

test("createTaskSession creates valid session", async () => {
  const { createTaskSession } = await import("../core/models.js");
  const session = createTaskSession({
    id: "test-session",
    description: "Test",
    durationMinutes: 25,
    standStats: { STR: 3, INT: 2 },
  });
  assert.equal(session.id, "test-session");
  assert.equal(session.description, "Test");
  assert.equal(session.durationMinutes, 25);
  assert.deepEqual(session.standStats, { STR: 3, INT: 2 });
});

test("createQuest creates valid quest", async () => {
  const { createQuest } = await import("../core/models.js");
  const quest = createQuest({
    id: "test-quest",
    label: "Morning Run",
    defaultDurationMinutes: 30,
    stats: { STR: 2, STA: 3, VIT: 2 },
  });
  assert.equal(quest.id, "test-quest");
  assert.equal(quest.label, "Morning Run");
  assert.equal(quest.defaultDurationMinutes, 30);
});

test("getLevelProgress returns valid progress", async () => {
  const { getLevelProgress } = await import("../core/exp.js");
  const progress = getLevelProgress(150);
  assert.ok(typeof progress.level === "number", "should have level");
  assert.ok(typeof progress.current === "number", "should have current");
  assert.ok(typeof progress.required === "number", "should have required");
  assert.ok(typeof progress.ratio === "number", "should have ratio");
  assert.ok(progress.ratio >= 0 && progress.ratio <= 1, "ratio should be between 0 and 1");
});

test("STAT_KEYS contains expected stats", async () => {
  const { STAT_KEYS } = await import("../core/models.js");
  const expected = ["STR", "DEX", "STA", "INT", "SPI", "CHA", "VIT"];
  expected.forEach(stat => {
    assert.ok(STAT_KEYS.includes(stat), `STAT_KEYS should include ${stat}`);
  });
});

test("questStatsToChartStats converts quest stats correctly", async () => {
  const { questStatsToChartStats } = await import("../core/questStorage.js");
  const questStats = { STR: 3, INT: 2, VIT: 1, DEX: 0 };
  
  // At duration=0: base tier
  const baseStats = questStatsToChartStats(questStats, 0);
  assert.ok(baseStats.STR > 1, "allocation 3 at t=0 should be above E");
  assert.ok(baseStats.INT > 1, "allocation 2 at t=0 should be above E");
  assert.ok(baseStats.VIT > 1, "allocation 1 at t=0 should be above E");
  assert.equal(baseStats.DEX, 1, "allocation 0 should always be E (1)");
  
  // At duration=120: max tier for max allocation
  const targetStats = questStatsToChartStats(questStats, 120);
  assert.equal(targetStats.STR, 6, "allocation 3 at 120min should reach S (6)");
  assert.ok(targetStats.INT > baseStats.INT, "allocation 2 should grow with duration");
  assert.ok(targetStats.VIT > baseStats.VIT, "allocation 1 should grow with duration");
  assert.equal(targetStats.DEX, 1, "allocation 0 should always be E (1)");
});

test("getExpDistribution returns correct ratios", async () => {
  const { getExpDistribution } = await import("../core/questStorage.js");
  const questStats = { STR: 2, VIT: 1, STA: 1 }; // total 4
  const dist = getExpDistribution(questStats);
  assert.equal(dist.STR, 0.5, "STR should get 50% (2/4)");
  assert.equal(dist.VIT, 0.25, "VIT should get 25% (1/4)");
  assert.equal(dist.STA, 0.25, "STA should get 25% (1/4)");
  assert.equal(dist.INT, 0, "INT should get 0% (0/4)");
});
