"use client";

import { ClipOutbound } from "@/components/clip-outbound";
import type { ClipLookup } from "@/lib/scrub-film";
import type { Drive, GameSummary, PlayByPlayPlay } from "@/lib/types";
import { playPeriodLabel, type PeriodSport } from "@/lib/espn-parse";
import { useEffect, useMemo, useRef } from "react";

export function PlayByPlay({
  drives,
  plays = [],
  game,
  available,
  note,
  mode = "drives",
  periodSport,
  clipForPlay,
}: {
  drives: Drive[];
  plays?: PlayByPlayPlay[];
  game: GameSummary;
  available: boolean;
  note: string;
  mode?: "drives" | "plays";
  periodSport?: PeriodSport;
  clipForPlay?: (play: PlayByPlayPlay) => ClipLookup;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const sport = periodSport ?? (mode === "plays" ? "basketball" : "football");
  const playCount =
    mode === "plays" ? plays.length : drives.reduce((sum, drive) => sum + drive.plays.length, 0);

  const byPeriod = useMemo(() => {
    if (mode !== "plays") return [];
    const groups: Array<{ period: number | null; plays: PlayByPlayPlay[] }> = [];
    for (const play of plays) {
      const last = groups[groups.length - 1];
      if (last && last.period === play.period) {
        last.plays.push(play);
      } else {
        groups.push({ period: play.period, plays: [play] });
      }
    }
    return groups;
  }, [mode, plays]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [drives, plays]);

  if (!available) {
    return (
      <div className="board-glass px-4 py-8">
        <p className="font-display text-lg tracking-[0.14em] text-white">
          PLAY-BY-PLAY NOT ON THIS FEED
        </p>
        <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-white/60">
          {note}
        </p>
        {game.situation?.lastPlay ? (
          <p className="mt-4 border-l-2 border-[#cc0000] pl-3 font-mono text-xs text-white/80">
            Last published snap: {game.situation.lastPlay}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="board-glass">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="font-display text-sm tracking-[0.2em] text-[#f3c14b]">
          PLAY-BY-PLAY
        </h2>
        <p className="font-mono text-[10px] text-white/40">{playCount} PLAYS</p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {mode === "plays"
          ? byPeriod.map((group) => (
              <section key={`period-${group.period ?? "na"}`} className="border-b border-white/8">
                <header className="sticky top-0 bg-[#1a1a1a] px-3 py-1.5">
                  <p className="font-display text-[11px] tracking-[0.14em] text-white">
                    {playPeriodLabel(group.period, sport) || "PLAYS"}
                  </p>
                </header>
                <ol className="divide-y divide-white/5">
                  {group.plays.map((play) => (
                    <PlayRow
                      key={play.id}
                      play={play}
                      game={game}
                      sport={sport}
                      clip={play.scoringPlay ? clipForPlay?.(play) : undefined}
                    />
                  ))}
                </ol>
              </section>
            ))
          : drives.map((drive) => (
              <section key={drive.id} className="border-b border-white/8">
                <header className="sticky top-0 flex items-center justify-between gap-2 bg-[#1a1a1a] px-3 py-1.5">
                  <p className="font-display text-[11px] tracking-[0.14em] text-white">
                    {(drive.teamName || "DRIVE").toUpperCase()}
                    {drive.result ? `  ·  ${drive.result.toUpperCase()}` : ""}
                  </p>
                  <p className="font-mono text-[10px] text-white/45">
                    {drive.description}
                    {drive.yards != null ? `  ·  ${drive.yards} yds` : ""}
                  </p>
                </header>
                <ol className="divide-y divide-white/5">
                  {drive.plays.map((play) => (
                    <PlayRow
                      key={play.id}
                      play={play}
                      game={game}
                      sport={sport}
                      clip={play.scoringPlay ? clipForPlay?.(play) : undefined}
                    />
                  ))}
                </ol>
              </section>
            ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function PlayRow({
  play,
  game,
  sport,
  clip,
}: {
  play: PlayByPlayPlay;
  game: GameSummary;
  sport: PeriodSport;
  clip?: ClipLookup;
}) {
  return (
    <li
      className={`flex gap-3 px-3 py-2 ${play.scoringPlay ? "bg-[#2a1200]" : ""}`}
    >
      <div className="w-14 shrink-0 font-mono text-[10px] leading-4 text-white/40">
        <div>{playPeriodLabel(play.period, sport)}</div>
        <div>{play.clock ?? ""}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[12px] leading-5 text-white/85">{play.text}</p>
        {play.scoringPlay ? (
          <div className="mt-1 space-y-2">
            <p className="font-display text-[11px] tracking-[0.12em] text-[#f3c14b]">
              {game.away.abbreviation} {play.awayScore}  {"  "}
              {game.home.abbreviation} {play.homeScore}
            </p>
            {clip ? <ClipOutbound clip={clip} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
