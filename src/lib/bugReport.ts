import type { ModalEntry } from "./types";

// Everything auto-captured with a bug report, so the maintainer doesn't need
// a screenshot to know where the reporter was. Stored verbatim in
// bug_reports.context (JSONB).
export interface BugContext {
  page: string; // human label, e.g. "Review", "Word sheet"
  hash: string; // raw location.hash for the exact route
  entity: string | null; // active word/char, e.g. "word:你好" | "char:好"
  version: string; // the "chinese vNN" build label
  userAgent: string;
  viewport: string; // "390×844"
  language: string;
  standalone: boolean; // running as an installed PWA
  online: boolean;
  timestamp: string; // ISO
}

export interface PageInput {
  hash: string;
  top: ModalEntry | null;
  sentenceMode: boolean;
}

// The surface the reporter is looking at. An open sheet/tree wins over the
// underlying route — that's what's on screen.
export function describePage({ hash, top, sentenceMode }: PageInput): string {
  if (top) {
    const kind = top.kind === "word" ? "Word" : "Character";
    return `${kind} ${top.view === "tree" ? "tree" : "sheet"}`;
  }
  if (sentenceMode) return "Sentence Studio";
  switch (hash) {
    case "#/review":
      return "Review";
    case "#/cards":
      return "Flashcards";
    case "#/explore":
      return "Explore";
    case "#/classic":
      return "三字经 Classic";
    case "#/stats":
      return "Stats";
    default:
      return "Home";
  }
}

export function buildBugContext(input: PageInput & { version: string }): BugContext {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const standalone =
    (typeof window !== "undefined" &&
      !!window.matchMedia?.("(display-mode: standalone)").matches) ||
    // iOS Safari's non-standard flag for a home-screen PWA.
    (nav as unknown as { standalone?: boolean })?.standalone === true;
  return {
    page: describePage(input),
    hash: input.hash || "",
    entity: input.top ? `${input.top.kind}:${input.top.key}` : null,
    version: input.version,
    userAgent: nav?.userAgent ?? "",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "",
    language: nav?.language ?? "",
    standalone,
    online: nav?.onLine ?? true,
    timestamp: new Date().toISOString(),
  };
}
