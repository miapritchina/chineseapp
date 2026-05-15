import { afterEach, describe, expect, it } from "vitest";
import {
  loadObjectMap,
  loadTimestampMap,
  loadVersionedMap,
  persistObjectMap,
  persistTimestampMap,
  persistVersionedMap,
} from "./localCache";

afterEach(() => {
  localStorage.clear();
});

describe("loadTimestampMap / persistTimestampMap", () => {
  it("round-trips a typical map", () => {
    const m = new Map([
      ["你好", 1700000000000],
      ["再见", 1700000001000],
    ]);
    persistTimestampMap("k", m);
    const back = loadTimestampMap("k");
    expect(back).toEqual(m);
  });

  it("returns empty map when key is missing", () => {
    expect(loadTimestampMap("missing").size).toBe(0);
  });

  it("returns empty map when JSON is malformed", () => {
    localStorage.setItem("k", "not json");
    expect(loadTimestampMap("k").size).toBe(0);
  });

  it("upgrades the legacy string[] shape with `now` timestamps", () => {
    localStorage.setItem("k", JSON.stringify(["a", "b", "c"]));
    const m = loadTimestampMap("k");
    expect([...m.keys()].sort()).toEqual(["a", "b", "c"]);
    for (const ts of m.values()) {
      expect(typeof ts).toBe("number");
    }
  });

  it("filters out malformed items", () => {
    localStorage.setItem(
      "k",
      JSON.stringify({
        version: 2,
        items: [
          ["good", 1],
          ["bad", "nope"],
          [42, 2],
        ],
      }),
    );
    const m = loadTimestampMap("k");
    expect([...m.entries()]).toEqual([["good", 1]]);
  });

  it("rejects payloads with the wrong version", () => {
    localStorage.setItem("k", JSON.stringify({ version: 99, items: [["a", 1]] }));
    expect(loadTimestampMap("k").size).toBe(0);
  });
});

describe("loadObjectMap / persistObjectMap", () => {
  interface Entry {
    text: string;
    updatedAt: number;
  }
  const isEntry = (v: unknown): v is Entry =>
    !!v && typeof v === "object" && "text" in v && "updatedAt" in v;

  it("round-trips", () => {
    const m = new Map<string, Entry>([["k", { text: "hi", updatedAt: 1 }]]);
    persistObjectMap("kk", m);
    const back = loadObjectMap<Entry>("kk", isEntry);
    expect(back).toEqual(m);
  });

  it("drops entries failing the type guard", () => {
    localStorage.setItem("kk", JSON.stringify({ good: { text: "ok", updatedAt: 1 }, bad: 42 }));
    const back = loadObjectMap<Entry>("kk", isEntry);
    expect([...back.keys()]).toEqual(["good"]);
  });
});

describe("loadVersionedMap / persistVersionedMap", () => {
  const isString = (v: unknown): v is string => typeof v === "string";

  it("round-trips at the given version", () => {
    const m = new Map([
      ["a", "1"],
      ["b", "2"],
    ]);
    persistVersionedMap("v", 7, m);
    expect(loadVersionedMap("v", 7, isString)).toEqual(m);
  });

  it("rejects mismatched versions", () => {
    persistVersionedMap("v", 7, new Map([["a", "1"]]));
    expect(loadVersionedMap("v", 8, isString).size).toBe(0);
  });
});
