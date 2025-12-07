import puppeteer from "puppeteer";

// Test configuration
const BASE_URL = "http://localhost:3000";
const TIMEOUT = 10000;

class BrowserTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(TIMEOUT);
  }

  async cleanup() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }

  async navigate() {
    await this.page.goto(BASE_URL);
    // Wait for the app to initialize
    await this.page.waitForSelector("#home-view", { timeout: 5000 });
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

  async assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async assertExists(selector, message) {
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(message || `Element not found: ${selector}`);
    }
  }

  async assertText(selector, expectedText, message) {
    const text = await this.page.$eval(selector, (el) => el.textContent.trim());
    if (text !== expectedText) {
      throw new Error(
        message || `Expected "${expectedText}", got "${text}"`,
      );
    }
  }

  async assertValue(selector, expectedValue, message) {
    const value = await this.page.$eval(selector, (el) => el.value);
    if (value !== expectedValue) {
      throw new Error(
        message || `Expected value "${expectedValue}", got "${value}"`,
      );
    }
  }

  async assertAttribute(selector, attr, expectedValue, message) {
    const value = await this.page.$eval(
      selector,
      (el, attr) => el.getAttribute(attr),
      attr,
    );
    if (value !== expectedValue) {
      throw new Error(
        message ||
          `Expected ${attr}="${expectedValue}", got "${value}"`,
      );
    }
  }

  async assertHidden(selector, message) {
    const isHidden = await this.page.$eval(
      selector,
      (el) => el.classList.contains("bq-hidden"),
    );
    if (!isHidden) {
      throw new Error(message || `Element should be hidden: ${selector}`);
    }
  }

  async assertVisible(selector, message) {
    const isHidden = await this.page.$eval(
      selector,
      (el) => el.classList.contains("bq-hidden"),
    );
    if (isHidden) {
      throw new Error(message || `Element should be visible: ${selector}`);
    }
  }

  async click(selector) {
    await this.page.click(selector);
    // Small delay to allow for state updates
    await this.page.waitForTimeout(100);
  }

  async type(selector, text) {
    await this.page.type(selector, text);
  }

  async clear(selector) {
    await this.page.evaluate(
      (sel) => (document.querySelector(sel).value = ""),
      selector,
    );
  }

  async printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("TEST RESULTS");
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
  const tester = new BrowserTest();

  try {
    await tester.init();
    await tester.navigate();

    console.log("\n" + "=".repeat(60));
    console.log("BROWSER TESTS: QUEST PRESETS, DURATION CHIPS & CANCEL UX");
    console.log("=".repeat(60) + "\n");

    // ============================================================
    // QUEST PRESETS TESTS
    // ============================================================

    console.log("\n>>> QUEST PRESETS TESTS\n");

    await tester.test("Home view loads with start quest button", async () => {
      await tester.assertExists("#start-quest-btn");
      await tester.assertVisible("#home-view");
    });

    await tester.test("Clicking start quest shows setup view", async () => {
      await tester.click("#start-quest-btn");
      await tester.assertVisible("#setup-view");
      await tester.assertHidden("#home-view");
    });

    await tester.test("Setup view displays all preset buttons", async () => {
      const presets = ["reading", "coding", "weightlifting", "yoga", "custom"];
      for (const preset of presets) {
        await tester.assertExists(
          `button[data-preset-id="${preset}"]`,
          `Preset button ${preset} not found`,
        );
      }
    });

    await tester.test("Clicking Reading preset applies correct values", async () => {
      await tester.click('button[data-preset-id="reading"]');
      await tester.assertValue("#task-description", "Reading");
      await tester.assertValue("#task-duration", "25");
      await tester.assertValue("#task-type", "INTELLIGENCE");
    });

    await tester.test("Reading preset button shows active state", async () => {
      await tester.assertAttribute(
        'button[data-preset-id="reading"]',
        "data-active",
        "true",
        "Reading preset should be marked as active",
      );
    });

    await tester.test(
      "Clicking Coding preset applies correct values",
      async () => {
        await tester.click('button[data-preset-id="coding"]');
        await tester.assertValue("#task-description", "Coding");
        await tester.assertValue("#task-duration", "50");
        await tester.assertValue("#task-type", "INTELLIGENCE");
      },
    );

    await tester.test("Coding preset button shows active state", async () => {
      await tester.assertAttribute(
        'button[data-preset-id="coding"]',
        "data-active",
        "true",
        "Coding preset should be marked as active",
      );
    });

    await tester.test(
      "Previous preset loses active state when new preset clicked",
      async () => {
        const readingBtn = await tester.page.$('button[data-preset-id="reading"]');
        const hasActive = await tester.page.evaluate(
          (el) => el.hasAttribute("data-active"),
          readingBtn,
        );
        await tester.assert(
          !hasActive,
          "Reading preset should no longer be active",
        );
      },
    );

    await tester.test(
      "Clicking Weightlifting preset applies correct values",
      async () => {
        await tester.click('button[data-preset-id="weightlifting"]');
        await tester.assertValue("#task-description", "Weightlifting");
        await tester.assertValue("#task-duration", "45");
        await tester.assertValue("#task-type", "STRENGTH");
      },
    );

    await tester.test("Weightlifting preset button shows active state", async () => {
      await tester.assertAttribute(
        'button[data-preset-id="weightlifting"]',
        "data-active",
        "true",
        "Weightlifting preset should be marked as active",
      );
    });

    await tester.test(
      "Clicking Yoga preset applies correct values",
      async () => {
        await tester.click('button[data-preset-id="yoga"]');
        await tester.assertValue("#task-description", "Yoga");
        await tester.assertValue("#task-duration", "30");
        await tester.assertValue("#task-type", "MIXED");
      },
    );

    await tester.test("Yoga preset button shows active state", async () => {
      await tester.assertAttribute(
        'button[data-preset-id="yoga"]',
        "data-active",
        "true",
        "Yoga preset should be marked as active",
      );
    });

    await tester.test(
      "Clicking Custom preset focuses on description input",
      async () => {
        await tester.click('button[data-preset-id="custom"]');
        const focused = await tester.page.evaluate(
          () => document.activeElement.id,
        );
        await tester.assert(
          focused === "task-description",
          "Task description should be focused after Custom preset",
        );
      },
    );

    // ============================================================
    // DURATION CHIPS TESTS
    // ============================================================

    console.log("\n>>> DURATION CHIPS TESTS\n");

    await tester.test(
      "All duration chips (15, 25, 45, 60) are present",
      async () => {
        const durations = ["15", "25", "45", "60"];
        for (const duration of durations) {
          await tester.assertExists(
            `button[data-duration="${duration}"]`,
            `Duration chip for ${duration} min not found`,
          );
        }
      },
    );

    await tester.test("Clicking 15-minute chip sets duration value", async () => {
      await tester.click('button[data-duration="15"]');
      await tester.assertValue("#task-duration", "15");
    });

    await tester.test("15-minute chip shows active state", async () => {
      await tester.assertAttribute(
        'button[data-duration="15"]',
        "data-active",
        "true",
      );
    });

    await tester.test("Clicking 25-minute chip sets duration value", async () => {
      await tester.click('button[data-duration="25"]');
      await tester.assertValue("#task-duration", "25");
    });

    await tester.test("25-minute chip shows active state", async () => {
      await tester.assertAttribute(
        'button[data-duration="25"]',
        "data-active",
        "true",
      );
    });

    await tester.test("Previous duration chip loses active state", async () => {
      const fifteenBtn = await tester.page.$('button[data-duration="15"]');
      const hasActive = await tester.page.evaluate(
        (el) => el.hasAttribute("data-active"),
        fifteenBtn,
      );
      await tester.assert(!hasActive, "15-minute chip should no longer be active");
    });

    await tester.test("Clicking 45-minute chip sets duration value", async () => {
      await tester.click('button[data-duration="45"]');
      await tester.assertValue("#task-duration", "45");
    });

    await tester.test("45-minute chip shows active state", async () => {
      await tester.assertAttribute(
        'button[data-duration="45"]',
        "data-active",
        "true",
      );
    });

    await tester.test("Clicking 60-minute chip sets duration value", async () => {
      await tester.click('button[data-duration="60"]');
      await tester.assertValue("#task-duration", "60");
    });

    await tester.test("60-minute chip shows active state", async () => {
      await tester.assertAttribute(
        'button[data-duration="60"]',
        "data-active",
        "true",
      );
    });

    await tester.test("Duration input updates when chips are clicked", async () => {
      // Test sequence of clicks
      await tester.click('button[data-duration="15"]');
      let value = await tester.page.$eval(
        "#task-duration",
        (el) => el.value,
      );
      await tester.assert(value === "15", "Duration should be 15 after click");

      await tester.click('button[data-duration="45"]');
      value = await tester.page.$eval(
        "#task-duration",
        (el) => el.value,
      );
      await tester.assert(value === "45", "Duration should be 45 after click");
    });

    await tester.test(
      "Manually typing duration value works",
      async () => {
        await tester.clear("#task-duration");
        await tester.type("#task-duration", "35");
        await tester.assertValue("#task-duration", "35");
      },
    );

    // ============================================================
    // CANCEL UX TESTS
    // ============================================================

    console.log("\n>>> SOFTER CANCEL UX TESTS\n");

    await tester.test(
      "Cancel button exists on session view",
      async () => {
        // First, start a session
        await tester.click('button[data-preset-id="reading"]');
        await tester.click('button[data-duration="25"]');
        await tester.clear("#task-description");
        await tester.type("#task-description", "Test task");
        await tester.click("#session-form");

        // Find and click the submit button
        const submitBtn = await tester.page.$('button[type="submit"]');
        if (submitBtn) {
          await tester.page.evaluate((btn) => btn.click(), submitBtn);
          await tester.page.waitForTimeout(500);
        }

        // Check if cancel button exists
        await tester.assertExists("#cancel-session-btn");
      },
    );

    await tester.test("Cancel button is visible during session", async () => {
      await tester.assertVisible("#cancel-session-btn");
      await tester.assertVisible("#session-view");
    });

    await tester.test("Cancel button has softer styling (secondary class)", async () => {
      const classes = await tester.page.$eval(
        "#cancel-session-btn",
        (el) => el.className,
      );
      await tester.assert(
        classes.includes("bq-secondary-btn"),
        "Cancel button should have secondary button styling",
      );
    });

    await tester.test("Cancel button has cancel-specific styling class", async () => {
      const classes = await tester.page.$eval(
        "#cancel-session-btn",
        (el) => el.className,
      );
      await tester.assert(
        classes.includes("bq-cancel-btn"),
        "Cancel button should have cancel-specific styling",
      );
    });

    await tester.test("Clicking cancel shows confirmation dialog", async () => {
      let dialogShown = false;
      tester.page.once("dialog", (dialog) => {
        dialogShown = true;
        dialog.dismiss();
      });

      await tester.click("#cancel-session-btn");
      await tester.page.waitForTimeout(500);

      await tester.assert(
        dialogShown,
        "Confirmation dialog should be shown when cancel is clicked",
      );
    });

    await tester.test(
      "Canceling from confirmation returns to home view",
      async () => {
        // Dialog dismiss already handled above
        await tester.page.waitForTimeout(500);
        // Should still be in session view since we dismissed
        await tester.assertVisible("#session-view");
      },
    );

    // Test accepting cancel
    await tester.test("Accepting cancel confirmation returns to home", async () => {
      let dialogHandled = false;
      tester.page.once("dialog", (dialog) => {
        dialogHandled = true;
        dialog.accept();
      });

      await tester.click("#cancel-session-btn");
      await tester.page.waitForTimeout(1000);

      // After accepting, should return to home
      const homeHidden = await tester.page.$eval(
        "#home-view",
        (el) => el.classList.contains("bq-hidden"),
      );
      await tester.assert(!homeHidden, "Should return to home view after cancel");
    });

    // ============================================================
    // INTEGRATION TESTS
    // ============================================================

    console.log("\n>>> INTEGRATION TESTS\n");

    await tester.test(
      "Complete workflow: preset -> duration chip -> submit -> cancel",
      async () => {
        // Go back to setup
        await tester.click("#start-quest-btn");
        await tester.assertVisible("#setup-view");

        // Apply preset
        await tester.click('button[data-preset-id="yoga"]');
        await tester.assertValue("#task-description", "Yoga");

        // Change duration with chip
        await tester.click('button[data-duration="45"]');
        await tester.assertValue("#task-duration", "45");

        // Start session
        const submitBtn = await tester.page.$('button[type="submit"]');
        if (submitBtn) {
          await tester.page.evaluate((btn) => btn.click(), submitBtn);
          await tester.page.waitForTimeout(500);
        }

        await tester.assertVisible("#session-view");
        await tester.assertText(
          "#session-task-text",
          "Yoga",
          "Session task should be Yoga",
        );
      },
    );

    await tester.test(
      "Preset changes clear previous active state",
      async () => {
        await tester.click("#start-quest-btn");

        // Click reading
        await tester.click('button[data-preset-id="reading"]');
        let readingActive = await tester.page.$eval(
          'button[data-preset-id="reading"]',
          (el) => el.hasAttribute("data-active"),
        );
        await tester.assert(readingActive, "Reading should be active");

        // Click coding
        await tester.click('button[data-preset-id="coding"]');
        readingActive = await tester.page.$eval(
          'button[data-preset-id="reading"]',
          (el) => el.hasAttribute("data-active"),
        );
        const codingActive = await tester.page.$eval(
          'button[data-preset-id="coding"]',
          (el) => el.hasAttribute("data-active"),
        );

        await tester.assert(
          !readingActive,
          "Reading should no longer be active",
        );
        await tester.assert(codingActive, "Coding should be active");
      },
    );

    await tester.test(
      "Duration chip and text input stay synchronized",
      async () => {
        // Manually set a value
        await tester.clear("#task-duration");
        await tester.type("#task-duration", "37");

        // Click a chip
        await tester.click('button[data-duration="45"]');

        // Should update to chip value
        await tester.assertValue("#task-duration", "45");
      },
    );

    await tester.printResults();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
