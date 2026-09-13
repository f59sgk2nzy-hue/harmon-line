"use client";

import type { GameSummary } from "@/lib/types";

function tickerText(game: GameSummary): string {
  const away = `${game.away.rank ? `#${game.away.rank} ` : ""}${game.away.abbreviation}`;
  const home = `${game.home.rank ? `#${game.home.rank} ` : ""}${game.home.abbreviation}`;
  if (game.status.state === "pre") {
    return `${away} @ ${home}  ${game.status.shortDetail}`;
  }
  const awayScore = game.away.score ?? 0;
  const homeScore = game.home.score ?? 0;
  return `${away} ${awayScore}  ${home} ${homeScore}  ${game.status.shortDetail}`;
}

export function BottomLine({ games }: { games: GameSummary[] }) {
  const items = games.length > 0 ? games : [];
  const loop = items.length > 0 ? [...items, ...items] : [];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex h-10 border-t border-black bg-black pb-[env(safe-area-inset-bottom)] text-white"
      style={{ viewTransitionName: "bottom-line" }}
    >
      <div className="espn-red-bar flex shrink-0 items-center px-3 font-display text-[11px] tracking-[0.2em] sm:text-xs">
        BOTTOM LINE
      </div>
      <div className="relative flex-1 overflow-hidden bg-[#111]">
        {loop.length === 0 ? (
          <p className="flex h-full items-center px-4 font-mono text-[11px] text-white/60">
            No games on this board yet — flip the date or division.
          </p>
        ) : (
          <div className="ticker-track flex h-full items-center gap-8 whitespace-nowrap">
            {loop.map((game, index) => (
              <span
                key={`${game.id}-${index}`}
                className="inline-flex items-center gap-3 font-mono text-[11px] tracking-wide text-white sm:text-xs"
              >
                {game.status.state === "in" && (
                  <span className="live-pill px-1.5 font-display text-[10px] tracking-[0.16em]">
                    <span className="live-dot" />
                    LIVE
                  </span>
                )}
                {tickerText(game)}
                <span className="text-[#f3c14b]">●</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
