// Browser TTS helpers. Only the lightweight Web Speech API path —
// nothing fancy, nothing networked. Falls back silently when:
//   - The browser doesn't expose speechSynthesis (older platforms).
//   - The user hasn't interacted yet and autoplay policy blocks.
//   - No zh-CN voice is installed.
//
// All callers should treat these as fire-and-forget.

let pendingTimer: number | null = null;

function utter(text: string, lang: string): void {
  const synth = window.speechSynthesis;
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.85;
  // Prefer an installed Chinese voice — relying on `lang` alone makes
  // some platforms pick a poor match or clip the utterance.
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("zh"));
  if (voice) u.voice = voice;
  synth.speak(u);
}

/**
 * Speak `text` once. Cancels any in-flight utterance so quick swipes
 * through review cards don't queue up a backlog of audio. When a
 * cancel is needed, the new utterance is deferred a beat — calling
 * speak() in the same tick as cancel() makes iOS/Chrome clip the
 * start of the audio (the "sound is slightly cut" bug).
 */
export function speak(text: string, lang: string = "zh-CN"): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (synth.speaking || synth.pending) {
      synth.cancel();
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        try {
          utter(text, lang);
        } catch {
          /* no-op */
        }
      }, 120);
    } else {
      utter(text, lang);
    }
  } catch {
    /* no-op */
  }
}

/** Stop whatever's playing (used on unmount). */
export function stopSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    window.speechSynthesis?.cancel?.();
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
