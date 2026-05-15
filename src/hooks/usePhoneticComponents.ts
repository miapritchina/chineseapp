import { useEffect, useState } from "react";

export interface PhoneticComponent {
  char: string;
  pinyin: string; // tone-free
  pinyinTones: string; // raw, with diacritics
  count: number; // # of distinct chars that use it as a sound component
  family: string[]; // capped sample of those chars
}

interface State {
  components: PhoneticComponent[];
  byChar: Map<string, PhoneticComponent>;
  ready: boolean;
}

const EMPTY: State = { components: [], byChar: new Map(), ready: false };

// Loads ./phonetic-components.json (built by
// scripts/extract-phonetic-components.mjs). Soft-fails on network error so
// the rest of the app keeps working without phonetic data.
export function usePhoneticComponents(): State {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("./phonetic-components.json", { cache: "no-cache" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const components = (json.components || []) as PhoneticComponent[];
        const byChar = new Map<string, PhoneticComponent>();
        for (const c of components) byChar.set(c.char, c);
        if (!cancelled) setState({ components, byChar, ready: true });
      } catch (err) {
        console.warn("phonetic-components load failed:", err);
        if (!cancelled) setState({ ...EMPTY, ready: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
