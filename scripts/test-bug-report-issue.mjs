// Tests for scripts/bugIssue.mjs — the pure title/body formatters that turn a
// bug_reports row into a GitHub issue. Run: node scripts/test-bug-report-issue.mjs

import assert from "node:assert/strict";
import { issueTitle, issueBody, BUG_LABEL } from "./bugIssue.mjs";

const sample = {
  id: "11111111-2222-4333-8444-555555555555",
  note: "Audio doesn't play on the review card",
  created_at: "2026-08-25T00:00:00Z",
  user_id: null,
  context: {
    page: "Review",
    hash: "#/review",
    entity: "word:你好",
    version: "chinese v148",
    viewport: "390×844",
    userAgent: "Mozilla/5.0 (iPhone)",
    language: "en-US",
    standalone: true,
    online: true,
    timestamp: "2026-08-25T00:00:00.000Z",
  },
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("label constant is stable", () => {
  assert.equal(BUG_LABEL, "bug-report");
});

test("title includes a [bug] tag, the note, and the page", () => {
  const t = issueTitle(sample);
  assert.match(t, /^\[bug\] /);
  assert.ok(t.includes("Audio doesn't play"));
  assert.ok(t.includes("Review"));
});

test("title falls back when the note is empty", () => {
  const t = issueTitle({ ...sample, note: "" });
  assert.ok(t.includes("(no description)"));
  assert.ok(t.includes("Review"));
});

test("title collapses newlines and truncates long notes", () => {
  const long = "x".repeat(200);
  const t = issueTitle({ ...sample, note: `${long}\nsecond line` });
  assert.ok(t.length < 120);
  assert.ok(t.endsWith("…") || t.includes("…"));
});

test("body carries the note and the reproduction context", () => {
  const b = issueBody(sample);
  assert.ok(b.includes("Audio doesn't play on the review card"));
  assert.ok(b.includes("| Version | chinese v148 |"));
  assert.ok(b.includes("| Word / char | word:你好 |"));
  assert.ok(b.includes("| Route | #/review |"));
  assert.ok(b.includes("| Installed PWA | yes |"));
  assert.ok(b.includes("anonymous")); // user_id null → anonymous
  assert.ok(b.includes(sample.id)); // provenance footer
});

test("body omits empty context fields (no blank table rows)", () => {
  const b = issueBody({ id: sample.id, note: "just this", created_at: "", user_id: null, context: {} });
  assert.ok(b.includes("just this"));
  assert.ok(!b.includes("| Version |"));
  assert.ok(!b.includes("| Viewport |"));
});

test("body escapes pipe characters in device strings", () => {
  const b = issueBody({ ...sample, context: { ...sample.context, userAgent: "a|b|c" } });
  assert.ok(b.includes("a\\|b\\|c"));
});

test("a signed-in reporter's id shows instead of anonymous", () => {
  const b = issueBody({ ...sample, user_id: "abc-123" });
  assert.ok(b.includes("| Reporter | abc-123 |"));
  assert.ok(!b.includes("| Reporter | anonymous |"));
});

let failures = 0;
for (const t of tests) {
  try {
    t.fn();
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
