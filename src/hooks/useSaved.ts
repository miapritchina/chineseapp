import { useCallback, useState } from "react";

const STORAGE_KEY = "chinese.saved";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage may be blocked in private mode; silent */
  }
}

export function useSaved() {
  const [saved, setSaved] = useState<Set<string>>(() => load());

  const toggle = useCallback((key: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const exportSaved = useCallback(() => {
    const items = [...saved];
    if (!items.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      app: "chinese",
      exported: new Date().toISOString(),
      count: items.length,
      saved: items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chinese-saved-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [saved]);

  return { saved, toggle, exportSaved };
}
