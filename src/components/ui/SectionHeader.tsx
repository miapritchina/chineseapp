// EntitySheet section header: `ETYMOLOGY`, `IN YOUR SAVED WORDS`, etc.
// Emits the existing `.sheet-section-head` / `.sheet-section-name` classes.
interface Props {
  name: string;
}

export function SectionHeader({ name }: Props) {
  return (
    <div className="sheet-section-head">
      <span className="sheet-section-name">{name}</span>
    </div>
  );
}
