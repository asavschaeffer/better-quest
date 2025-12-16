import {
  standExpToPoints,
  computeBudgetForStat,
  computeDailyBudgets,
  dampingMultiplier,
} from "../mobile/core/fatigue.js";
import { STAT_KEYS } from "../mobile/core/models.js";

class TestRunner {
  constructor() {
    this.results = { passed: 0, failed: 0, tests: [] };
  }

  async test(name, fn) {
    try {
      await fn();
      this.results.passed += 1;
      this.results.tests.push({ name, status: "PASS" });
      console.log(`✓ ${name}`);
    } catch (err) {
      this.results.failed += 1;
      this.results.tests.push({ name, status: "FAIL", error: err.message });
      console.log(`✗ ${name}`);
      console.log(`  Error: ${err.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertClose(actual, expected, tolerance = 0.05, message) {
    const delta = Math.abs(actual - expected);
    if (delta > Math.abs(expected) * tolerance) {
      throw new Error(
        message || `Expected ${expected}±${tolerance * 100}%, got ${actual}`,
      );
    }
  }

  printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("FATIGUE TEST RESULTS");
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
  console.log("FATIGUE MECHANICS TESTS");
  console.log("=".repeat(60) + "\n");

  // standExpToPoints
  await runner.test("standExpToPoints clamps low and returns at least 1", () => {
    runner.assertEqual(standExpToPoints(0), 1);
    runner.assertEqual(standExpToPoints(-5), 1);
  });

  await runner.test("standExpToPoints maps EXP thresholds to budget points", () => {
    runner.assertEqual(standExpToPoints(599), 1);
    runner.assertEqual(standExpToPoints(600), 2);
    runner.assertEqual(standExpToPoints(2399), 2);
    runner.assertEqual(standExpToPoints(2400), 3);
  });

  // computeBudgetForStat
  await runner.test("computeBudgetForStat uses streak 70% / level 30%", () => {
    const budget = computeBudgetForStat({
      statPoints: 3,
      level: 30,
      mandalaStreak: 21,
      aggregateConsistency: 1,
      basePerPoint: 120,
    });
    // Base = 3 * 120 = 360; multiplier = 1 + 0.7*1 + 0.3*1 = 2
    runner.assertEqual(budget, 720);
  });

  await runner.test("computeBudgetForStat respects minimum stat points of 1", () => {
    const budget = computeBudgetForStat({ statPoints: 0, basePerPoint: 100 });
    runner.assertEqual(budget, 100); // base multiplier defaults to 1
  });

  // computeDailyBudgets
  await runner.test("computeDailyBudgets returns all STAT_KEYS", () => {
    const budgets = computeDailyBudgets({
      standExp: { STR: 2400, INT: 600 },
      level: 10,
      mandalaStreak: 5,
    });
    runner.assertEqual(Object.keys(budgets).length, STAT_KEYS.length);
    STAT_KEYS.forEach((k) => runner.assert(k in budgets, `${k} missing`));
  });

  // dampingMultiplier
  await runner.test("dampingMultiplier returns 1 when under budget or no budget", () => {
    runner.assertEqual(dampingMultiplier({ spent: 50, budget: 100 }), 1);
    runner.assertEqual(dampingMultiplier({ spent: 50, budget: 0 }), 1);
  });

  await runner.test("dampingMultiplier decays smoothly toward floor past budget", () => {
    const m = dampingMultiplier({ spent: 200, budget: 100, floor: 0.4 });
    // At 2x budget: 0.4 + 0.6*e^-1 ≈ 0.6207
    runner.assertClose(m, 0.6207, 0.02);
    runner.assert(m > 0.4, "Should stay above floor");
  });

  const ok = runner.printResults();
  if (!ok) process.exitCode = 1;
}

runTests();
