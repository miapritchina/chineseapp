// "Share my words" links. Two flavours, picked at share time:
//
//  * Short link — `?share=<token>` where <token> is a random 12-char id.
//    The word list lives in Supabase (`user_shares` table, read back via
//    the `get_shared_words` RPC). Used when the user is signed in (and the
//    table exists / the insert succeeds). Tiny link regardless of list size.
//
//  * Inline link — `?share=<lz-string blob>`: the whole list compressed
//    straight into the URL, no backend. The fallback for signed-out users
//    or when the DB write fails. Compression keeps it ~2.5–3× shorter than
//    plain base64-of-JSON; `decodeWords` also still understands that
//    original uncompressed base64 format (links shared before v88).
//
// Either way the recipient's ?share= handler in App.tsx ends up calling
// `importSaved`, which syncs to `user_saves` as usual. The payload is just
// a copy of state that already lives there, so the inline form persists
// nothing new and the short-link table is non-authoritative.
//
// Round-trip behaviour is pinned by scripts/test-share.mjs — keep in sync.

import LZString from "lz-string";

export const SHARE_PARAM = "share";

// ── Inline payload (lz-string, with a legacy base64 fallback) ──────────

function asWordList(parsed: unknown): string[] | null {
  if (!Array.isArray(parsed)) return null;
  const words = parsed.filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  return words.length > 0 ? words : null;
}

function fromLegacyBase64Url(token: string): unknown {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
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

// ── Short-link tokens (the Supabase `user_shares` path) ────────────────

// 12 chars from a 32-symbol unambiguous alphabet (no 0/o/1/l) ≈ 60 bits —
// collision-proof at any realistic scale; if one ever collides the INSERT
// fails on the PK and the caller falls back to an inline link.
const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // exactly 32 chars
const TOKEN_LEN = 12;

export function makeShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LEN));
  let s = "";
  for (let i = 0; i < TOKEN_LEN; i++) s += TOKEN_ALPHABET[bytes[i] & 31];
  return s;
}

// Does a `?share=` value look like a short token rather than an inline
// payload? Tokens are 12 lowercase-alphanumeric chars; lz-string / legacy
// base64 payloads use mixed case and/or `+ - _ $`, so they almost never
// match. A rare false positive just costs one wasted DB miss before the
// caller falls back to inline decode.
export function looksLikeShareToken(value: string): boolean {
  return /^[a-z0-9]{12}$/.test(value);
}

// ── URL assembly ───────────────────────────────────────────────────────

// Build an absolute share URL for the current deployment from a ?share=
// value (a token or an inline payload), dropping any existing query/hash.
export function shareUrl(shareValue: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_PARAM, shareValue);
  return url.toString();
}
