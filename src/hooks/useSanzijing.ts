import { useEffect, useState } from "react";

// The Three Character Classic — static public data, same pattern as
// useChars/usePhoneticComponents. Standard 1068-character edition,
// simplified, with Herbert Giles' public-domain line translations
// grouped per couplet (two 3-char lines).

export interface ClassicCouplet {
  a: string; // first 3-char line
  b: string; // second 3-char line
  en: string; // Giles (1900) translation of the couplet
  mod: string; // modern plain-English interpretation
}

export interface ClassicData {
  title: string;
  titleEn: string;
  source: string;
  couplets: ClassicCouplet[];
}

export function useSanzijing() {
  const [data, setData] = useState<ClassicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("./sanzijing.json", { cache: "no-cache" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as ClassicData;
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
