import { useCallback, useMemo, useRef } from "react";

// HanziWriter is loaded as a global script tag in index.html; declare it.
declare global {
  interface Window {
    HanziWriter: any;
  }
}

export interface StrokeData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

export function useStrokeData() {
  const cacheRef = useRef<Map<string, StrokeData | null>>(new Map());

  const load = useCallback(async (char: string): Promise<StrokeData | null> => {
    const cache = cacheRef.current;
    if (cache.has(char)) return cache.get(char) ?? null;
    if (typeof window.HanziWriter === "undefined") return null;
    try {
      const data = await window.HanziWriter.loadCharacterData(char);
      cache.set(char, data || null);
      return data || null;
    } catch {
      cache.set(char, null);
      return null;
    }
  }, []);

  const get = useCallback((char: string): StrokeData | null => {
    return cacheRef.current.get(char) ?? null;
  }, []);

  return useMemo(() => ({ load, get }), [load, get]);
}
