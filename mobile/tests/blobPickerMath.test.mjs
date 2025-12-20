import test from "node:test";
import assert from "node:assert/strict";

import {
  NUM_STATS,
  MIN_VAL,
  MAX_VAL,
  axisFromAngle,
  circularDistance,
  clamp,
  distanceToTarget,
  applyIntegerMagnetism,
  snapToInteger,
  thinFromLowest,
  applySurfaceTension,
  dragUpdate,
  snapAll,
  angleForAxis,
} from "../core/blobPickerMath.js";

// --- clamp ---
test("clamp keeps values in [0, 3]", () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(0), 0);
  assert.equal(clamp(1.5), 1.5);
  assert.equal(clamp(3), 3);
  assert.equal(clamp(4), 3);
});

// --- axisFromAngle ---
test("axisFromAngle maps angles to 0..6", () => {
  // Top (-π/2) should be axis 0
  const top = axisFromAngle(-Math.PI / 2);
  assert.equal(top, 0);
  
  // Right (0) should be around axis 1-2
  const right = axisFromAngle(0);
  assert.ok(right >= 1 && right <= 2);
  
  // All results should be in range
  for (let a = -Math.PI; a < Math.PI; a += 0.1) {
    const idx = axisFromAngle(a);
    assert.ok(idx >= 0 && idx < NUM_STATS, `angle ${a} gave ${idx}`);
  }
});

// --- circularDistance ---
test("circularDistance computes shortest path on ring", () => {
  assert.equal(circularDistance(0, 0), 0);
  assert.equal(circularDistance(0, 1), 1);
  assert.equal(circularDistance(0, 3), 3);
  // Wrapping: 0 to 6 is 1 step (not 6)
  assert.equal(circularDistance(0, 6), 1);
  assert.equal(circularDistance(1, 5), 3);
});

// --- distanceToTarget ---
test("distanceToTarget maps 0..1 to 0..3 with curve", () => {
  assert.equal(distanceToTarget(0), 0);
  assert.ok(distanceToTarget(0.5) > 1.2 && distanceToTarget(0.5) < 1.8);
  assert.equal(distanceToTarget(1), 3);
  // Clamped beyond range
  assert.equal(distanceToTarget(2), 3);
  assert.equal(distanceToTarget(-1), 0);
});

// --- applyIntegerMagnetism ---
test("applyIntegerMagnetism snaps when very close", () => {
  const { value, snapped } = applyIntegerMagnetism(1.99, 0.5, 0.2);
  assert.equal(value, 2);
  assert.equal(snapped, true);
});

test("applyIntegerMagnetism pulls toward integer within threshold", () => {
  const { value, snapped } = applyIntegerMagnetism(1.85, 0.3, 0.2);
  assert.ok(value > 1.85, "should pull up toward 2");
  assert.ok(value < 2, "should not snap fully yet");
});

test("applyIntegerMagnetism leaves values far from integer alone", () => {
  const { value, snapped } = applyIntegerMagnetism(1.5, 0.3, 0.2);
  assert.equal(value, 1.5);
  assert.equal(snapped, false);
});

// --- snapToInteger ---
test("snapToInteger rounds and clamps", () => {
  assert.equal(snapToInteger(1.4), 1);
  assert.equal(snapToInteger(1.6), 2);
  assert.equal(snapToInteger(-0.5), 0);
  assert.equal(snapToInteger(3.9), 3);
});

// --- thinFromLowest ---
test("thinFromLowest removes from lowest values first", () => {
  const input = [1, 2, 3, 0.5, 1.5, 2.5, 1];
  const result = thinFromLowest(input, 2, 1, 0.5); // pulling idx 2, delta 1
  
  // Active axis (2) should be unchanged by thinning
  assert.equal(result[2], input[2]);
  
  // The lowest value (idx 3 = 0.5) should have been reduced the most
  assert.ok(result[3] < input[3], "lowest should shrink");
  
  // Higher values should shrink less or not at all
  assert.ok(result[2] === input[2], "active unchanged");
});

test("thinFromLowest does nothing for negative delta", () => {
  const input = [1, 1, 1, 1, 1, 1, 1];
  const result = thinFromLowest(input, 0, -0.5, 0.5);
  assert.deepEqual(result, input);
});

// --- applySurfaceTension ---
test("applySurfaceTension makes neighbors follow", () => {
  const input = [1, 1, 1, 1, 1, 1, 1];
  const result = applySurfaceTension(input, 0, 0.5, 0.3);
  
  // Active axis unchanged by tension (it's done separately)
  assert.equal(result[0], input[0]);
  
  // Neighbors (1, 6) should have increased
  assert.ok(result[1] > input[1], "neighbor 1 should follow");
  assert.ok(result[6] > input[6], "neighbor 6 should follow");
  
  // Distant axes (3) should be unchanged or barely changed
  assert.ok(Math.abs(result[3] - input[3]) < 0.05, "distant axis should not move much");
});

// --- dragUpdate ---
test("dragUpdate increases active axis toward target", () => {
  const input = [1, 1, 1, 1, 1, 1, 1];
  const result = dragUpdate(input, 0, 2.5, { followSpeed: 0.5 });
  
  // Active axis should move toward target
  assert.ok(result[0] > 1, "active should increase");
  assert.ok(result[0] < 2.5, "should not jump all the way");
});

test("dragUpdate thins low values when increasing", () => {
  const input = [0.5, 2, 3, 0.3, 1, 2, 1];
  const result = dragUpdate(input, 2, 3, { followSpeed: 0.8, thinCoupling: 0.5 });
  
  // Low values should have decreased
  assert.ok(result[3] <= input[3], "lowest should shrink or stay");
});

// --- snapAll ---
test("snapAll rounds all values to integers in range", () => {
  const input = [0.4, 1.6, 2.2, 2.8, 0.1, 1.5, 3.1];
  const result = snapAll(input);
  
  result.forEach((v, i) => {
    assert.ok(Number.isInteger(v), `${i} should be integer`);
    assert.ok(v >= MIN_VAL && v <= MAX_VAL, `${i} should be in range`);
  });
  
  assert.deepEqual(result, [0, 2, 2, 3, 0, 2, 3]);
});

// --- angleForAxis ---
test("angleForAxis is inverse of axisFromAngle", () => {
  for (let i = 0; i < NUM_STATS; i++) {
    const angle = angleForAxis(i);
    const recovered = axisFromAngle(angle);
    assert.equal(recovered, i, `axis ${i} should round-trip`);
  }
});

// --- invariants / safety ---
test("dragUpdate does not mutate input array", () => {
  const input = [1, 1, 1, 1, 1, 1, 1];
  const before = input.slice();
  dragUpdate(input, 0, 2.5, { followSpeed: 0.7, tensionSpread: 0.2, thinCoupling: 0.5 });
  assert.deepEqual(input, before);
});

test("dragUpdate output stays finite and clamped in [0, 3]", () => {
  // Deterministic pseudo-random (no Math.random in tests to keep them stable across runs)
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let t = 0; t < 200; t++) {
    const values = Array.from({ length: NUM_STATS }, () => MIN_VAL + rnd() * (MAX_VAL - MIN_VAL));
    const active = Math.floor(rnd() * NUM_STATS);
    const target = MIN_VAL + rnd() * (MAX_VAL - MIN_VAL);
    const next = dragUpdate(values, active, target, {
      followSpeed: 0.2 + rnd() * 0.8,
      tensionSpread: rnd() * 0.35,
      thinCoupling: rnd() * 0.7,
    });

    assert.equal(next.length, NUM_STATS);
    for (let i = 0; i < NUM_STATS; i++) {
      assert.ok(Number.isFinite(next[i]), `value ${i} should be finite`);
      assert.ok(next[i] >= MIN_VAL - 1e-9, `value ${i} should be >= ${MIN_VAL}`);
      assert.ok(next[i] <= MAX_VAL + 1e-9, `value ${i} should be <= ${MAX_VAL}`);
    }
  }
});

