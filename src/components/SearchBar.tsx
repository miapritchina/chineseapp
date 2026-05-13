import { useEffect, useRef } from "react";

export type SearchMode = "all" | "byComponent" | "sentence";

interface Props {
  value: string;
  onChange: (q: string) => void;
  onEnter: () => void;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
}

const PLACEHOLDER: Record<SearchMode, string> = {
  all: "Search 汉字, pinyin, English…",
  byComponent: "Find saved words containing this component…",
  sentence: "Type pinyin to filter your saved words…",
};

const TABS: { id: SearchMode; label: string }[] = [
  { id: "all", label: "Dictionary" },
  { id: "byComponent", label: "My Words by Component" },
  { id: "sentence", label: "Sentence" },
];

export function SearchBar({ value, onChange, onEnter, mode, onModeChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  // Keep input value in sync if state.query is reset elsewhere (e.g. ESC).
  useEffect(() => {
    if (ref.current && ref.current.value !== value) ref.current.value = value;
  }, [value]);

  const clear = () => {
    onChange("");
    if (ref.current) {
      ref.current.value = "";
      ref.current.focus();
    }
  };

  return (
    <div className="search-bar">
      <div className="search-mode-tabs" role="tablist" aria-label="Search mode">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            className={`search-mode-tab${mode === t.id ? " is-active" : ""}`}
            onClick={() => onModeChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="search-field">
        <input
          ref={ref}
          id="search"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={PLACEHOLDER[mode]}
          aria-label="Search words"
          defaultValue={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              clear();
            } else if (e.key === "Enter") {
              onEnter();
            }
          }}
        />
        {value && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            title="Clear"
            onMouseDown={(e) => e.preventDefault()} // keep input focused
            onClick={clear}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
