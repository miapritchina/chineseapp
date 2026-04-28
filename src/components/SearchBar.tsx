import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (q: string) => void;
  onEnter: () => void;
}

export function SearchBar({ value, onChange, onEnter }: Props) {
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
      <div className="search-field">
        <input
          ref={ref}
          id="search"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search 汉字, pinyin, English…"
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
