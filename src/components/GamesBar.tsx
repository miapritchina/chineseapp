export interface GameEntry {
  id: string;
  icon: string;
  name: string;
  ready: boolean;
  onStart: () => void;
}

// Home-page games row (v161, owner request — moved off the review
// launch screen so play is one tap from home). Pure play, no grading.
export function GamesBar({ games }: { games: GameEntry[] }) {
  if (!games.some((g) => g.ready)) return null;
  return (
    <section className="games-bar" aria-label="Games">
      <div className="shelf-title">Games</div>
      <div className="games-row">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className="game-tile"
            onClick={g.onStart}
            disabled={!g.ready}
          >
            <span className="game-tile-icon" aria-hidden="true">
              {g.icon}
            </span>
            <span className="game-tile-name">{g.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
