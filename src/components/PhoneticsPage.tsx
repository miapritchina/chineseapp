import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { StatusButton } from "./StatusButton";
import { useSavedCtx } from "../state/contexts";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  components: PhoneticComponent[];
  ready: boolean;
  onClose: () => void;
}

// Browse the top ~250 productive sound components ranked by how many
// other characters they appear in. Tap a row's status button to save it
// (or change its tier) — once saved, the componentSound drill auto-seeds
// for it via the useReview reconcile rule. The list is read-only static
// data (public/phonetic-components.json).
export function PhoneticsPage({ components, ready, onClose }: Props) {
  const { getStatus, setStatus } = useSavedCtx();
  return (
    <div className="phonetics-root">
      <PageHeader onBack={onClose} tag="Phonetic components" progress={components.length} />
      {!ready ? (
        <EmptyState title="Loading…" />
      ) : components.length === 0 ? (
        <div className="empty-state">
          phonetic-components.json missing. Run{" "}
          <code>node scripts/extract-phonetic-components.mjs</code>.
        </div>
      ) : (
        <div className="phonetics-list">
          {components.map((c) => {
            const status = getStatus(c.char);
            return (
              <div key={c.char} className="phonetics-row">
                <span className="phonetics-row-char">{c.char}</span>
                <span className="phonetics-row-pinyin">{c.pinyin}</span>
                <span className="phonetics-row-count">in {c.count} chars</span>
                <span className="phonetics-row-family">
                  {c.family.slice(0, 6).join(" ")}
                  {c.family.length > 6 ? " …" : ""}
                </span>
                <span className="phonetics-row-status">
                  <StatusButton status={status} onChange={(next) => setStatus(c.char, next)} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
