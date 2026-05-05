// Type declarations for the plain ES-module sibling componentSearch.mjs.
// Kept here so the file stays loadable from Node tests without a build,
// while still being type-safe inside the React app.

import type { Char } from "./types";

export function componentClosure(
  word: string,
  chars: Record<string, Char>,
): Set<string>;

export function searchByComponent(
  query: string,
  savedWords: string[],
  chars: Record<string, Char>,
): string[];
