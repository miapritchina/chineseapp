// Tests for src/lib/share.ts → encodeWords / decodeWords (the round-trip
// behind the "Share my words" link). Run with: node scripts/test-share.mjs
//
// Mirrors the browser implementation (btoa/atob + TextEncoder/TextDecoder
// all exist in Node 18+); keep in sync with src/lib/share.ts.

import assert from "node:assert/strict";

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token) {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeWords(words) {
  return toBase64Url(JSON.stringify(words));
}

function decodeWords(token) {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed)) return null;
    const words = parsed.filter((x) => typeof x === "string" && x.length > 0);
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("round-trips a typical saved set", () => {
  const words = ["你好", "老师", "中文", "学习", "好"];
  assert.deepEqual(decodeWords(encodeWords(words)), words);
});

test("token is URL-safe (no +, /, = or whitespace)", () => {
  const token = encodeWords(["你好世界", "再見", "謝謝", "對不起", "沒關係"]);
  assert.ok(!/[+/=\s]/.test(token), `token had unsafe chars: ${token}`);
});

test("handles a large list without blowing the call stack", () => {
  const words = Array.from({ length: 5000 }, (_, i) => `词${i}`);
  assert.deepEqual(decodeWords(encodeWords(words)), words);
});

test("single word", () => {
  assert.deepEqual(decodeWords(encodeWords(["好"])), ["好"]);
});

test("empty list encodes and decodes to null (nothing to import)", () => {
  // encodeWords([]) → "[]" encoded; decodeWords drops it because there's
  // nothing useful to import.
  assert.equal(decodeWords(encodeWords([])), null);
});

test("drops non-string and empty entries", () => {
  const token = encodeWords(["好", "", "学"]);
  assert.deepEqual(decodeWords(token), ["好", "学"]);
});

test("garbage / truncated tokens → null, never throws", () => {
  assert.equal(decodeWords("not-base64-$$$"), null);
  assert.equal(decodeWords(""), null);
  assert.equal(decodeWords("YWJj"), null); // valid base64 of "abc" — not a JSON array
  assert.equal(decodeWords(encodeWords(["a"]).slice(0, -2) + "@@"), null);
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
