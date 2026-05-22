// Numbered EntitySheet section header: `Nº 01 · ETYMOLOGY`. Emits the
// existing `.sheet-section-head` / `-num` / `-name` classes.
interface Props {
  num: number;
  name: string;
}

export function SectionHeader({ num, name }: Props) {
  return (
    <div className="sheet-section-head">
      <span className="sheet-section-num">Nº {String(num).padStart(2, "0")}</span>
      <span className="sheet-section-name">{name}</span>
    </div>
  );
}
