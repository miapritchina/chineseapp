import { speak } from "../../lib/speech";

// TTS button. Wraps `speak()` and stops click propagation so it can sit
// inside a tap-to-advance / tap-to-open surface. Pass `className` to
// reuse an existing button style (e.g. `combined-replay`, `sheet-speak`).
interface Props {
  text: string;
  className?: string;
  label?: string;
}

export function SpeakButton({ text, className = "speak-btn", label = "🔊" }: Props) {
  return (
    <button
      type="button"
      className={className}
      aria-label={`Play pronunciation of ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      {label}
    </button>
  );
}
