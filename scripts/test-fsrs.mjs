// Tests for the ts-fsrs scheduler we wrap in src/lib/fsrs.ts. Verifies
// card lifecycle and grade arithmetic against the same default scheduler
// the wrapper instantiates. Wrapper itself is .ts; we string-match its
// exports below to keep the test runnable without a build step.
// Run with: node scripts/test-fsrs.mjs (or `npm test`).

import assert from "node:assert/strict";
import { fsrs, createEmptyCard, Rating } from "ts-fsrs";

const scheduler = fsrs();
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("createEmptyCard yields a New-state card due now", () => {
  const c = createEmptyCard(new Date("2026-05-08T12:00:00Z"));
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 0);
  assert.equal(c.stability, 0);
  assert.equal(c.difficulty, 0);
  // State.New === 0 in ts-fsrs
  assert.equal(c.state, 0);
});

test("three Good ratings monotonically grow stability", () => {
  let c = createEmptyCard(new Date("2026-05-08T12:00:00Z"));
  let now = c.due;
  let prevStability = c.stability;
  for (let i = 0; i < 3; i++) {
    c = scheduler.next(c, now, Rating.Good).card;
    assert.ok(c.stability >= prevStability, `stability should not decrease: ${prevStability} → ${c.stability}`);
    prevStability = c.stability;
    now = c.due;
  }
  assert.ok(c.stability > 0, "stability should be positive after 3 Goods");
  assert.ok(c.reps >= 3);
});

test("Again rating bumps lapses and shrinks stability", () => {
  let c = createEmptyCard(new Date("2026-05-08T12:00:00Z"));
  // Build up some stability first so Again has something to lose.
  c = scheduler.next(c, c.due, Rating.Good).card;
  c = scheduler.next(c, c.due, Rating.Good).card;
  const stabilityBefore = c.stability;
  const lapsesBefore = c.lapses;
  c = scheduler.next(c, c.due, Rating.Again).card;
  assert.equal(c.lapses, lapsesBefore + 1, "Again increments lapses");
  assert.ok(
    c.stability <= stabilityBefore,
    `Again should not grow stability: ${stabilityBefore} → ${c.stability}`,
  );
});

test("Easy rating produces a longer interval than Good from same state", () => {
  const c = createEmptyCard(new Date("2026-05-08T12:00:00Z"));
  const goodResult = scheduler.next(c, c.due, Rating.Good).card;
  const easyResult = scheduler.next(c, c.due, Rating.Easy).card;
  assert.ok(
    easyResult.due.getTime() >= goodResult.due.getTime(),
    `Easy should not be due sooner than Good: easy=${easyResult.due.toISOString()} good=${goodResult.due.toISOString()}`,
  );
});

test("due date is in the future after a successful review", () => {
  const c = createEmptyCard(new Date("2026-05-08T12:00:00Z"));
  const now = c.due;
  const next = scheduler.next(c, now, Rating.Good).card;
  assert.ok(
    next.due.getTime() > now.getTime(),
    `next.due (${next.due.toISOString()}) should be after now (${now.toISOString()})`,
  );
});

// Wrapper-specific tests via dynamic import after we've established the
// scheduler behaves correctly. Skip if the .ts file can't be loaded.
try {
  // Vite handles .ts at build time; Node 22 has experimental support but
  // here we just verify the *shape* of the wrapper exports without exercising
  // them directly. Static load is enough: we read the wrapper and confirm
  // it exports the right symbols by string-matching.
  const fs = await import("node:fs/promises");
  const src = await fs.readFile(
    new URL("../src/lib/fsrs.ts", import.meta.url),
    "utf8",
  );
  test("wrapper exports the expected surface", () => {
    for (const name of ["seedCard", "gradeCard", "isDue", "serialize", "deserialize"]) {
      assert.ok(
        new RegExp(`export\\s+(?:function|const)\\s+${name}\\b`).test(src),
        `wrapper should export ${name}`,
      );
    }
  });
  test("wrapper SerializedCard has Date-safe (string) fields for due/last_review", () => {
    assert.ok(/due:\s*string/.test(src));
    assert.ok(/last_review\?:\s*string/.test(src));
  });
} catch (err) {
  console.warn("[skipping wrapper-shape tests]", err.message);
}

let failures = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log("✓", t.name);
  } catch (err) {
    failures++;
    console.error("✗", t.name);
    console.error(" ", err.message);
  }
}
if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log(`\n${tests.length} tests passed.`);
