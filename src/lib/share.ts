// Self-contained "share my saved words" links. The word list is encoded
// straight into the URL (url-safe base64 of UTF-8 JSON) — no backend, no
// stored share record: the recipient opens the link and the app offers to
// import the words (see the ?share= handler in App.tsx). The shared payload
// is just a copy of state that already lives in Supabase (user_saves), so
// there's nothing new to persist.
//
// Round-trip behaviour is pinned by scripts/test-share.mjs — keep in sync.

export const SHARE_PARAM = "share";

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeWords(words: string[]): string {
  return toBase64Url(JSON.stringify(words));
}

export function decodeWords(token: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(token));
    if (!Array.isArray(parsed)) return null;
    const words = parsed.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    return words.length > 0 ? words : null;
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
