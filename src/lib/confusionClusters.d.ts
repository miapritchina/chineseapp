// Type declarations for the .mjs sibling so the React app can import
// these helpers with type-safety.

export const CONFUSION_CLUSTERS: readonly (readonly string[])[];
export const LEECH_LAPSES: number;

export function clusterFor(char: string): string[] | null;
export function neighbors(char: string): string[];
