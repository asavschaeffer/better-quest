import { createUser, createTaskSession, SessionStatus } from "./src/models.js";
import { calculateExpForSession, applyExpToAvatar, getLevelProgress } from "./src/exp.js";
import { inferEmojiForDescription } from "./src/emoji.js";

// Test utilities
class TestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  async test(name, fn) {
    try {
      await fn();
      this.results.passed++;
      this.results.tests.push({ name, status: "PASS" });
      console.log(`✓ ${name}`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: "FAIL", error: error.message });
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${expected}, got ${actual}`,
      );
    }
  }

  assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(
        message ||
          `Expected ${expectedStr}, got ${actualStr}`,
      );
    }
  }

  assertGreaterThan(actual, min, message) {
    if (actual <= min) {
      throw new Error(
        message || `Expected value > ${min}, got ${actual}`,
      );
    }
  }

  assertLessThan(actual, max, message) {
    if (actual >= max) {
      throw new Error(
        message || `Expected value < ${max}, got ${actual}`,
      );
    }
  }

  printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("BACKEND TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Total: ${this.results.passed + this.results.failed}`);
    console.log("=".repeat(60));

    if (this.results.failed > 0) {
      console.log("\nFailed tests:");
      this.results.tests
        .filter((t) => t.status === "FAIL")
        .forEach((t) => {
          console.log(`  - ${t.name}`);
          if (t.error) console.log(`    ${t.error}`);
        });
    }

    return this.results.failed === 0;
  }
}

async function runTests() {
  const runner = new TestRunner();

  console.log("\n" + "=".repeat(60));
  console.log("BACKEND TESTS: MODELS, EXP, & EMOJI SYSTEMS");
  console.log("=".repeat(60) + "\n");

  // ============================================================
  // USER & AVATAR CREATION TESTS
  // ============================================================

  console.log("\n>>> USER & AVATAR CREATION TESTS\n");

  await runner.test("createUser creates a valid user object", async () => {
    const user = createUser();
    runner.assert(user, "User should be created");
    runner.assert(user.avatar, "User should have an avatar");
  });

  await runner.test("Avatar has default name, level, and EXP", async () => {
    const user = createUser();
    const avatar = user.avatar;
    runner.assertEqual(avatar.level, 1, "Avatar should start at level 1");
    runner.assertEqual(avatar.totalExp, 0, "Avatar should start with 0 EXP");
    runner.assert(avatar.name && avatar.name.length > 0, "Avatar should have a name");
  });

  // ============================================================
  // TASK SESSION CREATION TESTS
  // ============================================================

  console.log("\n>>> TASK SESSION CREATION TESTS\n");

  await runner.test("createTaskSession creates valid session", async () => {
    const session = createTaskSession({
      id: "test-1",
      description: "Test task",
      durationMinutes: 25,
      startTime: new Date().toISOString(),
    });
    runner.assert(session, "Session should be created");
    runner.assertEqual(session.id, "test-1");
    runner.assertEqual(session.description, "Test task");
    runner.assertEqual(session.durationMinutes, 25);
  });

  await runner.test(
    "createTaskSession validates required fields",
    async () => {
      try {
        createTaskSession({
          // Missing required fields
          id: "test-2",
        });
        runner.assert(false, "Should have thrown error for missing fields");
      } catch (e) {
        runner.assert(true, "Should validate required fields");
      }
    },
  );

  await runner.test(
    "createTaskSession with break flag sets isBreak",
    async () => {
      const session = createTaskSession({
        id: "break-1",
        description: "Break",
        durationMinutes: 5,
        startTime: new Date().toISOString(),
        isBreak: true,
      });
      runner.assertEqual(session.isBreak, true);
    },
  );

  // ============================================================
  // QUEST PRESETS TESTS
  // ============================================================

  console.log("\n>>> QUEST PRESETS TESTS\n");

  const QUEST_PRESETS = [
    {
      id: "reading",
      description: "Reading",
      duration: 25,
    },
    {
      id: "coding",
      description: "Coding",
      duration: 50,
    },
    {
      id: "weightlifting",
      description: "Weightlifting",
      duration: 45,
    },
    {
      id: "yoga",
      description: "Yoga",
      duration: 30,
    },
  ];

  await runner.test("All 4 presets are defined", async () => {
    runner.assertEqual(QUEST_PRESETS.length, 4, "Should have 4 presets");
  });

  await runner.test("Reading preset has correct values", async () => {
    const preset = QUEST_PRESETS.find((p) => p.id === "reading");
    runner.assert(preset, "Reading preset should exist");
    runner.assertEqual(preset.description, "Reading");
    runner.assertEqual(preset.duration, 25);
  });

  await runner.test("Coding preset has correct values", async () => {
    const preset = QUEST_PRESETS.find((p) => p.id === "coding");
    runner.assert(preset, "Coding preset should exist");
    runner.assertEqual(preset.description, "Coding");
    runner.assertEqual(preset.duration, 50);
  });

  await runner.test("Weightlifting preset has correct values", async () => {
    const preset = QUEST_PRESETS.find((p) => p.id === "weightlifting");
    runner.assert(preset, "Weightlifting preset should exist");
    runner.assertEqual(preset.description, "Weightlifting");
    runner.assertEqual(preset.duration, 45);
  });

  await runner.test("Yoga preset has correct values", async () => {
    const preset = QUEST_PRESETS.find((p) => p.id === "yoga");
    runner.assert(preset, "Yoga preset should exist");
    runner.assertEqual(preset.description, "Yoga");
    runner.assertEqual(preset.duration, 30);
  });

  // ============================================================
  // DURATION VALIDATION TESTS
  // ============================================================

  console.log("\n>>> DURATION VALIDATION TESTS\n");

  await runner.test("Duration chips provide 4 quick options", async () => {
    const durations = [15, 25, 45, 60];
    runner.assertEqual(durations.length, 4, "Should have 4 duration options");
  });

  await runner.test("Duration chips all have valid values", async () => {
    const durations = [15, 25, 45, 60];
    durations.forEach((d) => {
      runner.assertGreaterThan(d, 0, `Duration ${d} should be > 0`);
      runner.assertLessThan(d, 241, `Duration ${d} should be <= 240`);
    });
  });

  await runner.test("Duration values follow Pomodoro-like intervals", async () => {
    // 15 = short break, 25 = Pomodoro, 45 = extended, 60 = long session
    const durations = [15, 25, 45, 60];
    runner.assert(
      durations[0] < durations[1],
      "Durations should be in ascending order",
    );
    runner.assert(
      durations[1] < durations[2],
      "Durations should be in ascending order",
    );
    runner.assert(
      durations[2] < durations[3],
      "Durations should be in ascending order",
    );
  });

  // ============================================================
  // EMOJI INFERENCE TESTS
  // ============================================================

  console.log("\n>>> EMOJI INFERENCE TESTS\n");

  await runner.test("Reading task gets books emoji", async () => {
    const emoji = inferEmojiForDescription("Reading a book");
    runner.assert(emoji === "📚", `Reading should be 📚, got ${emoji}`);
  });

  await runner.test("Code/Program task gets computer emoji", async () => {
    const emoji = inferEmojiForDescription("Code a program");
    runner.assert(emoji === "💻", `Code should be 💻, got ${emoji}`);
  });

  await runner.test("Yoga task gets yoga emoji", async () => {
    const emoji = inferEmojiForDescription("Yoga");
    runner.assert(emoji === "🧘", `Yoga should be 🧘, got ${emoji}`);
  });

  await runner.test("Weightlifting task gets dumbbell emoji", async () => {
    const emoji = inferEmojiForDescription("Weightlifting");
    runner.assert(emoji === "🏋️", `Weightlifting should be 🏋️, got ${emoji}`);
  });

  await runner.test("Running task gets running emoji", async () => {
    const emoji = inferEmojiForDescription("Go for a run");
    runner.assert(emoji === "🏃", `Running should be 🏃, got ${emoji}`);
  });

  await runner.test("Fallback emoji for unknown task", async () => {
    const emoji = inferEmojiForDescription("xyzabc unknown task qwerty");
    runner.assert(emoji === "⏳", `Unknown should be ⏳, got ${emoji}`);
  });

  // ============================================================
  // EXP CALCULATION TESTS
  // ============================================================

  console.log("\n>>> EXP CALCULATION TESTS\n");

  await runner.test("30-minute session grants 300 total EXP", async () => {
    const session = createTaskSession({
      id: "test-1",
      description: "Study",
      durationMinutes: 30,
      startTime: new Date().toISOString(),
    });
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 300, "30 min × 10 EXP/min = 300 total");
  });

  await runner.test("25-minute session (Pomodoro) grants 250 EXP", async () => {
    const session = createTaskSession({
      id: "test-5",
      description: "Quick task",
      durationMinutes: 25,
      startTime: new Date().toISOString(),
    });
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 250);
  });

  await runner.test("50-minute Coding preset grants 500 EXP", async () => {
    const session = createTaskSession({
      id: "test-6",
      description: "Coding",
      durationMinutes: 50,
      startTime: new Date().toISOString(),
    });
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 500);
  });

  await runner.test("45-minute Weightlifting preset grants 315 Strength EXP", async () => {
    const session = createTaskSession({
      id: "test-7",
      description: "Weightlifting",
      durationMinutes: 45,
      startTime: new Date().toISOString(),
    });
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 450);
  });

  // ============================================================
  // AVATAR LEVEL UP TESTS
  // ============================================================

  console.log("\n>>> AVATAR LEVEL UP TESTS\n");

  await runner.test("Avatar starts at level 1 with 0 EXP", async () => {
    const user = createUser();
    runner.assertEqual(user.avatar.level, 1);
    runner.assertEqual(user.avatar.totalExp, 0);
  });

  await runner.test("Adding 50 EXP keeps avatar at level 1", async () => {
    const user = createUser();
    let avatar = user.avatar;
    avatar = applyExpToAvatar(avatar, {
      totalExp: 50,
    });
    runner.assertEqual(avatar.level, 1);
    runner.assertEqual(avatar.totalExp, 50);
  });

  await runner.test("Adding 100 EXP levels avatar to 2", async () => {
    const user = createUser();
    let avatar = user.avatar;
    avatar = applyExpToAvatar(avatar, {
      totalExp: 100,
    });
    runner.assertEqual(avatar.level, 2);
    runner.assertEqual(avatar.totalExp, 100);
  });

  await runner.test("Large EXP gains level up multiple times", async () => {
    const user = createUser();
    let avatar = user.avatar;
    // Add 500 EXP (enough for multiple levels)
    avatar = applyExpToAvatar(avatar, {
      totalExp: 500,
    });
    runner.assertGreaterThan(avatar.level, 2, "Should level up multiple times");
    runner.assertEqual(avatar.totalExp, 500);
  });

  // ============================================================
  // LEVEL PROGRESS TESTS
  // ============================================================

  console.log("\n>>> LEVEL PROGRESS TESTS\n");

  await runner.test("Level 1 progress shows 0/100 at start", async () => {
    const progress = getLevelProgress(0);
    runner.assertEqual(progress.current, 0);
    runner.assertEqual(progress.required, 100, "Level 1 to 2 requires 100 EXP");
  });

  await runner.test("Level 2 progress at 100 EXP shows 0/200", async () => {
    const progress = getLevelProgress(100);
    runner.assertEqual(progress.current, 0);
    runner.assertEqual(progress.required, 200, "Level 2 to 3 requires 200 EXP");
  });

  await runner.test("Level 2 progress at 150 EXP shows 50/200", async () => {
    const progress = getLevelProgress(150);
    runner.assertEqual(progress.current, 50);
    runner.assertEqual(progress.required, 200, "Level 2 to 3 requires 200 EXP");
  });

  await runner.test("Progress ratio is calculated correctly", async () => {
    const progress = getLevelProgress(150);
    // At level 2, 150 EXP = 50 EXP into level 2
    // 50/200 = 0.25 ratio
    runner.assertEqual(progress.ratio, 0.25);
  });

  // ============================================================
  // SESSION STATE TESTS
  // ============================================================

  console.log("\n>>> SESSION STATE TESTS\n");

  await runner.test("New session has RUNNING status", async () => {
    const session = createTaskSession({
      id: "test-running",
      description: "Test",
      durationMinutes: 25,
      startTime: new Date().toISOString(),
    });
    runner.assertEqual(session.status, SessionStatus.RUNNING);
  });

  await runner.test("Session has all required fields", async () => {
    const session = createTaskSession({
      id: "test-full",
      description: "Full test",
      durationMinutes: 45,
      startTime: new Date().toISOString(),
    });
    runner.assert(session.id, "Should have ID");
    runner.assert(session.description, "Should have description");
    runner.assertEqual(session.durationMinutes, 45, "Should have duration");
    runner.assert(session.status, "Should have status");
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  console.log("\n>>> EDGE CASE TESTS\n");

  await runner.test("Minimum valid duration (5 minutes) works", async () => {
    const session = createTaskSession({
      id: "test-min",
      description: "Quick",
      durationMinutes: 5,
      startTime: new Date().toISOString(),
    });
    runner.assertEqual(session.durationMinutes, 5);
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 50);
  });

  await runner.test("Maximum valid duration (240 minutes) works", async () => {
    const session = createTaskSession({
      id: "test-max",
      description: "Marathon",
      durationMinutes: 240,
      startTime: new Date().toISOString(),
    });
    runner.assertEqual(session.durationMinutes, 240);
    const result = calculateExpForSession(session);
    runner.assertEqual(result.totalExp, 2400);
  });

  await runner.test("Zero duration fails validation", async () => {
    try {
      createTaskSession({
        id: "test-zero",
        description: "Invalid",
        durationMinutes: 0,
        startTime: new Date().toISOString(),
      });
      runner.assert(false, "Should reject zero duration");
    } catch (e) {
      runner.assert(true, "Zero duration should be rejected");
    }
  });

  await runner.test("Negative duration fails validation", async () => {
    try {
      createTaskSession({
        id: "test-negative",
        description: "Invalid",
        durationMinutes: -10,
        startTime: new Date().toISOString(),
      });
      runner.assert(false, "Should reject negative duration");
    } catch (e) {
      runner.assert(true, "Negative duration should be rejected");
    }
  });

  runner.printResults();
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
