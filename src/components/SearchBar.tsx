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

  return (
    <div className="search-bar">
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
            onChange("");
            (e.target as HTMLInputElement).value = "";
          } else if (e.key === "Enter") {
            onEnter();
          }
        }}
      />
    </div>
  );
}
