import type { CSSProperties } from "react";

// Adaptive scale factor for rendering a hanzi string at a fixed slot:
// the more characters, the smaller they render so cards / rows / chips
// never overflow. Pair with a CSS `font-size: calc(var(--hanzi-X) *
// var(--hanzi-scale, 1))` rule and set `--hanzi-scale` inline via
// hanziScaleStyle().
export function hanziScale(text: string | null | undefined): number {
  const n = [...(text ?? "")].length;
  if (n <= 1) return 1;
  if (n === 2) return 0.75;
  if (n === 3) return 0.65;
  return 0.5;
}

// Inline style object that sets the `--hanzi-scale` custom property.
export function hanziScaleStyle(text: string | null | undefined): CSSProperties {
  return { ["--hanzi-scale"]: hanziScale(text) } as CSSProperties;
}
