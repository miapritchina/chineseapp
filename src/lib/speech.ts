// Browser TTS helpers. Only the lightweight Web Speech API path —
// nothing fancy, nothing networked. Falls back silently when:
//   - The browser doesn't expose speechSynthesis (older platforms).
//   - The user hasn't interacted yet and autoplay policy blocks.
//   - No zh-CN voice is installed.
//
// All callers should treat these as fire-and-forget.

type Utterance = InstanceType<typeof window.SpeechSynthesisUtterance>;

let pendingTimer: number | null = null;
// Keep a live reference while speaking — Safari/Chrome may garbage-
// collect the utterance mid-playback otherwise, which truncates or
// crackles the audio.
let activeUtterance: Utterance | null = null;

// Minimal voice shape so picking is unit-testable without a browser.
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

// Best-quality Chinese voice. iOS lists the low-bitrate "compact"
// variant of each voice before the Enhanced/Premium variant of the
// SAME voice — taking the first zh match sounds like an old radio.
// Score: enhanced/premium name, then zh-CN region, then on-device.
export function pickVoice<T extends VoiceLike>(voices: T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    if (!lang.startsWith("zh")) continue;
    let score = 0;
    if (/enhanced|premium|superior/i.test(v.name)) score += 4;
    if (lang.startsWith("zh-cn")) score += 2;
    if (v.localService) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

// getVoices() is lazily populated on some platforms (notably iOS) —
// poke it at module load and on voiceschanged so the list is ready by
// the first speak().
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

function utter(text: string, lang: string): void {
  const synth = window.speechSynthesis;
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = lang;
  // Native rate on purpose — sub-1 rates resample on iOS and add a
  // warbling distortion on top of the compact-voice problem.
  const voice = pickVoice(synth.getVoices());
  if (voice) u.voice = voice;
  activeUtterance = u;
  u.onend = () => {
    if (activeUtterance === u) activeUtterance = null;
  };
  u.onerror = u.onend;
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
    activeUtterance = null;
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
