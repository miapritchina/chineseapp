// Generic localStorage map cache for cloud-synced hooks. Per CLAUDE.md +
// ADR-0001, Supabase is the source of truth; this module is the
// offline read-cache primitive every cloud-synced hook reuses.
//
// Two serialization shapes are supported:
//   - Versioned `{ version, items: [[key, value], ...] }` (recommended)
//   - Plain string-array (legacy useSaved v1) — handled on load only
//
// All operations are silent on failure: localStorage may be unavailable
// (private mode, quota exceeded, SSR). Callers fall back to an empty Map.

export interface VersionedPayload<V> {
  version: number;
  items: Array<[string, V]>;
}

export function loadVersionedMap<V>(
  storageKey: string,
  version: number,
  isValidValue: (v: unknown) => v is V,
): Map<string, V> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Partial<VersionedPayload<V>>;
    if (parsed && parsed.version === version && Array.isArray(parsed.items)) {
      return new Map(
        (parsed.items as unknown[]).filter(
          (it): it is [string, V] =>
            Array.isArray(it) && typeof it[0] === "string" && isValidValue(it[1]),
        ),
      );
    }
    return new Map();
  } catch {
    return new Map();
  }
}

export function persistVersionedMap<V>(
  storageKey: string,
  version: number,
  items: Map<string, V>,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version, items: [...items.entries()] }));
  } catch {
    /* private mode / quota — silent */
  }
}

// useSaved-style timestamp map: { version: 2, items: [[word, msEpoch], ...] }.
// Also accepts a plain string[] for back-compat with the pre-v2 format
// (records get `now` as their timestamp on read).
export function loadTimestampMap(storageKey: string): Map<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 2 && Array.isArray(parsed.items)) {
      return new Map(
        (parsed.items as unknown[]).filter(
          (it): it is [string, number] =>
            Array.isArray(it) && typeof it[0] === "string" && typeof it[1] === "number",
        ),
      );
    }
    if (Array.isArray(parsed)) {
      const now = Date.now();
      const entries = (parsed as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((w) => [w, now] as const);
      return new Map(entries);
    }
    return new Map();
  } catch {
    return new Map();
  }
}

export function persistTimestampMap(storageKey: string, items: Map<string, number>): void {
  persistVersionedMap(storageKey, 2, items);
}

// Plain object-shaped storage: { [key]: value }. Used by useMnemonics.
export function loadObjectMap<V>(
  storageKey: string,
  isValidValue: (v: unknown) => v is V,
): Map<string, V> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out = new Map<string, V>();
      for (const [k, v] of Object.entries(parsed)) {
        if (isValidValue(v)) out.set(k, v);
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

export function persistObjectMap<V>(storageKey: string, items: Map<string, V>): void {
  try {
    const obj: Record<string, V> = {};
    for (const [k, v] of items) obj[k] = v;
    localStorage.setItem(storageKey, JSON.stringify(obj));
  } catch {
    /* quota / private mode */
  }
}
