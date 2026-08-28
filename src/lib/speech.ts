// Audio helpers. Primary path (v106): per-word neural-TTS MP3s from
// Youdao's public dictionary-audio endpoint — the on-device iOS voices
// sound like an old radio even at their best (owner-verified in the
// iOS Settings preview), so device TTS is now only the fallback for
// offline / endpoint-failure. The service worker CacheFirst-caches
// each word's MP3, so a word heard once plays instantly and offline.
//
// All callers should treat these as fire-and-forget.

type Utterance = InstanceType<typeof window.SpeechSynthesisUtterance>;
type AudioEl = InstanceType<typeof window.Audio>;

export function youdaoUrl(text: string): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`;
}

// One shared element — iOS unlocks an <audio> element after its first
// user-gesture play, and reusing the element keeps that unlock.
let audioEl: AudioEl | null = null;

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

// Device-TTS path — the fallback. Cancels any in-flight utterance so
// quick swipes don't queue a backlog; when a cancel is needed the new
// utterance is deferred a beat (cancel + speak in the same tick makes
// iOS/Chrome clip the start — the old "sound is slightly cut" bug).
function speakWithSynth(text: string, lang: string): void {
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

/**
 * Speak `text` once, cancelling whatever is playing. Neural MP3 when
 * reachable; device TTS otherwise.
 */
export function speak(text: string, lang: string = "zh-CN"): void {
  if (typeof window === "undefined") return;
  stopSpeech();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!window.Audio || offline) {
    speakWithSynth(text, lang);
    return;
  }
  try {
    if (!audioEl) {
      audioEl = new window.Audio();
      audioEl.preload = "auto";
    }
    const el = audioEl;
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      speakWithSynth(text, lang);
    };
    el.onerror = fallback;
    el.src = youdaoUrl(text);
    void el.play().catch(fallback);
  } catch {
    speakWithSynth(text, lang);
  }
}

// Words whose MP3 has already been asked for — a fetch in flight or a
// finished one. Reset only by a reload, which is also when the service
// worker's tts-audio cache outlives us anyway.
const warmed = new Set<string>();

/**
 * Fetch the MP3s for `texts` ahead of time so a later speak() plays
 * from the service worker's tts-audio cache instead of waiting on a
 * Youdao round-trip — the audible lag when a card first appears.
 * Fire-and-forget; a failure just leaves the word cold.
 */
export function prefetchSpeech(texts: string[]): void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  for (const text of texts) {
    if (!text || warmed.has(text)) continue;
    warmed.add(text);
    // no-cors: the endpoint sends no CORS headers, and the response is
    // opaque — which is all the cache (and the audio element) needs.
    void window.fetch(youdaoUrl(text), { mode: "no-cors" }).catch(() => warmed.delete(text));
  }
}

// Auto-play preference (v114): drills speak answers on reveal unless
// the owner turns Sound off on the launch screen. Explicit 🔊 taps
// always go through speak() directly.
let autoSpeakOn = true;

export function setAutoSpeakEnabled(on: boolean): void {
  autoSpeakOn = on;
}

/** speak(), but only when the auto-play toggle is on. */
export function autoSpeak(text: string, lang: string = "zh-CN"): void {
  if (autoSpeakOn) speak(text, lang);
}

/** Stop whatever's playing (used on unmount and before a new speak). */
export function stopSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    if (audioEl) {
      audioEl.onerror = null;
      audioEl.pause();
    }
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
