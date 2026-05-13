// Self-contained "share my saved words" links. The word list is compressed
// (lz-string → URI-safe) straight into the URL — no backend, no stored share
// record: the recipient opens the link and the app offers to import the words
// (see the ?share= handler in App.tsx). The payload is just a copy of state
// that already lives in Supabase (user_saves), so there's nothing new to
// persist. Compression keeps the link short enough to paste into a messenger
// (~2.5–3× shorter than a plain base64-of-JSON link).
//
// Round-trip behaviour is pinned by scripts/test-share.mjs — keep in sync.

import LZString from "lz-string";

export const SHARE_PARAM = "share";

// Legacy decode: links shared by the first version of this feature used
// url-safe base64 of UTF-8 JSON (no compression). Still understood.
function fromLegacyBase64Url(token: string): unknown {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function asWordList(parsed: unknown): string[] | null {
  if (!Array.isArray(parsed)) return null;
  const words = parsed.filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  return words.length > 0 ? words : null;
}

export function encodeWords(words: string[]): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(words));
}

export function decodeWords(token: string): string[] | null {
  // Current format: lz-string EncodedURIComponent.
  try {
    const json = LZString.decompressFromEncodedURIComponent(token);
    if (json) {
      const words = asWordList(JSON.parse(json) as unknown);
      if (words) return words;
    }
  } catch {
    /* fall through to the legacy format */
  }
  // Legacy format: plain url-safe base64 of UTF-8 JSON.
  try {
    return asWordList(fromLegacyBase64Url(token));
  } catch {
    return null;
  }
}

// Build an absolute share URL for the current deployment, dropping any
// existing query/hash so the link is clean.
export function buildShareUrl(words: string[]): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_PARAM, encodeWords(words));
  return url.toString();
}
