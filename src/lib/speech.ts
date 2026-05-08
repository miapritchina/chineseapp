// Browser TTS helpers. Only the lightweight Web Speech API path —
// nothing fancy, nothing networked. Falls back silently when:
//   - The browser doesn't expose speechSynthesis (older platforms).
//   - The user hasn't interacted yet and autoplay policy blocks.
//   - No zh-CN voice is installed.
//
// All callers should treat these as fire-and-forget.

let cancelInflight = false;

/**
 * Speak `text` once. Cancels any in-flight utterance so quick swipes
 * through review cards don't queue up a backlog of audio.
 */
export function speak(text: string, lang: string = "zh-CN"): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    if (cancelInflight) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.85;
    cancelInflight = true;
    synth.speak(u);
  } catch {
    /* no-op */
  }
}

/** Stop whatever's playing (used on unmount). */
export function stopSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel?.();
    cancelInflight = false;
  } catch {
    /* no-op */
  }
}

/**
 * Pull the first reading out of a multi-reading pinyin string
 * ("lǐng;lìng;līng" → "lǐng"). Whitespace-trimmed; empty input is
 * passed through untouched.
 */
export function firstReading(s: string): string {
  if (!s) return s;
  const parts = s.split(/[;,/]/);
  return (parts[0] || "").trim();
}
