"use client";

import { ClipOutbound } from "@/components/clip-outbound";
import { FavoritePinButton } from "@/components/favorite-pin-button";
import { GamecastDepth } from "@/components/gamecast-depth";
import { PlayByPlay } from "@/components/play-by-play";
import { TeamLogo } from "@/components/team-logo";
import { sportBoardHref } from "@/lib/board-url";
import { formatKickoff, formatPollClock } from "@/lib/dates";
import { hasPeriodScores, periodLabel, periodSportFor, playPeriodLabel } from "@/lib/espn-parse";
import { deepDiveHref } from "@/lib/espn-stats";
import { teamHref } from "@/lib/espn-team";
import { oracleHrefForGame } from "@/lib/oracle";
import { clipLookupForGame } from "@/lib/scrub-film";
import { BOARD_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { GameDetailResponse, LeagueId, TeamSide } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import {
  HIGHLIGHTS_REFRESH_MS,
  type HighlightVideo,
  type HighlightsResponse,
} from "@/lib/youtube";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { useCallback, useState } from "react";

function ScoreColumn({
  team,
  possess,
  winner,
  league,
}: {
  team: TeamSide;
  possess: boolean;
  winner: boolean;
  league: LeagueId;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${winner ? "" : "opacity-80"}`}>
      <FavoritePinButton league={league} team={team} />
      <Link
        href={teamHref(team.id, league)}
        transitionTypes={["nav-forward"]}
        className="pressable shrink-0 no-underline"
      >
        <ViewTransition name={`team-logo-${team.id}`} share="morph" default="none">
          <span className="inline-flex">
            <TeamLogo
              src={team.logo}
              alt=""
              abbreviation={team.abbreviation}
              color={team.color}
              size={48}
            />
          </span>
        </ViewTransition>
      </Link>
      <div className="min-w-0">
        <Link
          href={teamHref(team.id, league)}
          transitionTypes={["nav-forward"]}
          className="pressable tap-row inline-flex items-center min-h-12 font-display text-xl leading-none tracking-wide text-white no-underline sm:text-3xl"
        >
          {team.rank ? <span className="mr-1 text-[#f3c14b]">{team.rank}</span> : null}
          {team.shortName.toUpperCase()}
          {possess ? <span className="ml-2 text-sm text-[#f3c14b]">●</span> : null}
        </Link>
        <p className="mt-1 font-mono text-[11px] text-white/50">
          {team.abbreviation}
          {team.record ? ` · ${team.record}` : ""}
          {team.conferenceName ? ` · ${team.conferenceName}` : ""}
        </p>
      </div>
      <p className="ml-auto font-display text-5xl leading-none tracking-tight text-white sm:text-6xl">
        {team.score ?? "–"}
      </p>
    </div>
  );
}

function QuarterRow({
  label,
  away,
  home,
}: {
  label: string;
  away: string | number;
  home: string | number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-white/8 px-2 py-1 font-mono text-[11px]">
      <span className="text-white/40">{label}</span>
      <span className="text-center text-white">{away}</span>
      <span className="text-center text-white">{home}</span>
    </div>
  );
}

export function GameDetailView({
  gameId,
  initial,
  initialError,
  league = DEFAULT_LEAGUE,
  initialHighlights = null,
}: {
  gameId: string;
  initial: GameDetailResponse | null;
  initialError?: string | null;
  league?: LeagueId;
  initialHighlights?: HighlightsResponse | null;
}) {
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState(initialError ?? null);
  const [highlightVideos, setHighlightVideos] = useState<HighlightVideo[]>(
    initialHighlights?.videos ?? []
  );

  const spec = getLeague(league);
  const football = spec.detailModules.footballSituation;
  const showDeepDive = league === "cfb";
  const periodSport = periodSportFor(league);

  const refresh = useCallback(async () => {
    try {
      const qs = league === DEFAULT_LEAGUE ? "" : `?league=${league}`;
      const response = await fetch(`/api/game/${gameId}${qs}`, { cache: "no-store" });
      const payload = (await response.json()) as GameDetailResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Game request failed");
      setDetail(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Game request failed");
    }
  }, [gameId, league]);

  const refreshHighlights = useCallback(async () => {
    try {
      const response = await fetch(`/api/highlights?league=${encodeURIComponent(league)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as HighlightsResponse;
      if (!response.ok) return;
      setHighlightVideos(payload.videos ?? []);
    } catch {
      // Keep last good YouTube list. Empty stays empty — never invent clips.
    }
  }, [league]);

  const live = detail?.game.status.state === "in";
  useLivePoll(refresh, { intervalMs: BOARD_REFRESH_MS });
  useLivePoll(refreshHighlights, {
    intervalMs: HIGHLIGHTS_REFRESH_MS,
    runOnMount: !initialHighlights,
  });

  if (!detail) {
    return (
      <div className="page-enter mx-auto max-w-5xl px-4 py-10">
        <Link
          href={sportBoardHref(league)}
          transitionTypes={["nav-back"]}
          className="pressable font-display text-xs tracking-[0.16em] text-white/60"
        >
          ← BACK TO THE BOARD
        </Link>
        <EmptyState
          className="mt-6"
          kicker="ESPN GAME FEED"
          headline={error ?? "LOADING GAME…"}
          detail="Live scores are never invented. If ESPN dropped this event, the board will stay empty."
        />
      </div>
    );
  }

  const {
    game,
    scoringPlays,
    drives,
    plays,
    leaders,
    playByPlayAvailable,
    coverage,
    teamStats,
    playerBox,
    standings,
    news,
  } = detail;
  const awayHasBall = football && game.situation?.possessionTeamId === game.away.id;
  const homeHasBall = football && game.situation?.possessionTeamId === game.home.id;
  const showQuarters =
    hasPeriodScores(game.away.linescores) || hasPeriodScores(game.home.linescores);
  const minPeriods =
    periodSport === "basketball" ? 2 : periodSport === "baseball" ? 0 : 4;
  const maxQ = showQuarters
    ? Math.max(minPeriods, game.away.linescores.length, game.home.linescores.length)
    : 0;
  const stamp = formatPollClock(detail.generatedAt);
  const pbpMode = spec.detailModules.primary === "drives" ? "drives" : "plays";
  const clipFor = (playText?: string | null, leader?: { name: string; category: string } | null) =>
    clipLookupForGame(highlightVideos, {
      league,
      away: game.away,
      home: game.home,
      playText,
      leader,
    });

  return (
    <div className="page-enter mx-auto w-full max-w-5xl px-3 py-4 pb-16 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={sportBoardHref(league)}
          transitionTypes={["nav-back"]}
          className="pressable inline-flex min-h-10 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70"
        >
          <ArrowLeft className="size-3.5" />
          BOARD
        </Link>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
            {game.subdivision}  ·  POLLED {stamp}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="pressable inline-flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 font-display text-[10px] tracking-[0.14em] text-white/70"
          >
            <RefreshCw className="size-3" />
            REFRESH
          </button>
        </div>
      </div>

      <section className={`score-cell overflow-hidden ${live ? "is-live" : ""}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <p className="font-display text-xs tracking-[0.2em] text-[#ff3b3b]">
            {game.status.state === "in" ? (
              <span className="live-pill">
                <span className="live-dot" />
                LIVE
              </span>
            ) : game.status.state === "post" ? (
              "FINAL"
            ) : (
              formatKickoff(game.date)
            )}
          </p>
          <p className="font-mono text-xs text-white/70">{game.status.detail}</p>
        </div>
        <div className="space-y-4 px-4 py-5">
          <ScoreColumn
            team={game.away}
            possess={Boolean(live && awayHasBall)}
            winner={game.status.state !== "post" || game.away.winner}
            league={league}
          />
          <ScoreColumn
            team={game.home}
            possess={Boolean(live && homeHasBall)}
            winner={game.status.state !== "post" || game.home.winner}
            league={league}
          />
        </div>
        <div
          className={`grid gap-3 border-t border-white/10 px-4 py-3 ${
            showQuarters ? "sm:grid-cols-[1fr_180px]" : ""
          }`}
        >
          <div>
            <p className="font-display text-[11px] tracking-[0.16em] text-[#f3c14b]">
              {football && live && game.situation?.downDistanceText
                ? `${game.situation.downDistanceText}${
                    game.situation.isRedZone ? "  ·  RED ZONE" : ""
                  }`
                : game.venue || game.venueCity || game.broadcast || game.status.shortDetail}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">
              {(football ? game.situation?.lastPlay : null) ||
                [game.venueCity, game.broadcast].filter(Boolean).join(" · ") ||
                "Waiting on the next published update."}
            </p>
          </div>
          {showQuarters ? (
            <div className="border border-white/10 bg-black/40">
              <div className="grid grid-cols-3 gap-2 px-2 py-1 font-display text-[10px] tracking-[0.12em] text-white/40">
                <span>
                  {periodSport === "basketball" ? "PER" : periodSport === "baseball" ? "INN" : "QTR"}
                </span>
                <span className="text-center">{game.away.abbreviation}</span>
                <span className="text-center">{game.home.abbreviation}</span>
              </div>
              {Array.from({ length: maxQ }).map((_, index) => (
                <QuarterRow
                  key={index}
                  label={periodLabel(index, periodSport)}
                  away={game.away.linescores[index] ?? "—"}
                  home={game.home.linescores[index] ?? "—"}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={oracleHrefForGame(game, league)}
          className="inline-flex min-h-11 items-center rounded-sm border border-white/20 bg-white/5 px-3 font-display text-[11px] tracking-[0.18em] text-white no-underline"
        >
          STAT ORACLE
        </Link>
        {showDeepDive ? (
          <Link
            href={deepDiveHref(game.id)}
            className="inline-flex min-h-11 items-center rounded-sm bg-[#cc0000] px-3 font-display text-[11px] tracking-[0.18em] text-white no-underline"
          >
            DEEP DIVE / SIM
          </Link>
        ) : null}
        <p className="self-center font-mono text-[10px] text-white/40">
          {showDeepDive
            ? "Ask the ESPN slice  ·  Matchup stats, simulation range, prop feedback"
            : "Ask a situational question on this ESPN slice"}
        </p>
      </div>

      {error ? (
        <p className="mt-3 border border-[#cc0000] bg-[#2a0000] px-3 py-2 font-mono text-xs text-[#ffb3b3]">
          Refresh error: {error}. Last good ESPN payload is still on screen.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PlayByPlay
          drives={drives}
          plays={plays ?? []}
          game={game}
          available={playByPlayAvailable}
          note={coverage.detail}
          mode={pbpMode}
          periodSport={periodSport}
          clipForPlay={(play) => clipFor(play.text)}
        />

        <aside className="space-y-4">
          <section className="board-glass">
            <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
              SCORING
            </h2>
            <p className="border-b border-white/8 px-3 py-1.5 font-mono text-[10px] leading-relaxed text-white/40">
              CLIP opens YouTube in a new tab when the highlights feed matches this play. Otherwise{" "}
              <span className="text-white/70">NO CLIP ON THIS FEED</span>. Never ESPN film.
            </p>
            {scoringPlays.length === 0 ? (
              <p className="px-3 py-4 font-mono text-[11px] text-white/45">
                No scoring plays published yet.
              </p>
            ) : (
              <ol className="divide-y divide-white/5">
                {scoringPlays.map((play) => (
                  <li key={play.id} className="px-3 py-2">
                    <p className="font-mono text-[10px] text-white/40">
                      {play.period ? playPeriodLabel(play.period, periodSport) : ""} {play.clock ?? ""} ·{" "}
                      {play.teamName ?? play.type}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-white/85">{play.text}</p>
                    <p className="font-display text-[11px] text-[#f3c14b]">
                      {game.away.abbreviation} {play.awayScore} · {game.home.abbreviation}{" "}
                      {play.homeScore}
                    </p>
                    <div className="mt-2">
                      <ClipOutbound clip={clipFor(play.text)} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="board-glass">
            <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
              LEADERS
            </h2>
            {leaders.length === 0 ? (
              <p className="px-3 py-4 font-mono text-[11px] text-white/45">
                Leaders not on this summary.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {leaders.map((line) => (
                  <li key={`${line.category}-${line.name}`} className="px-3 py-2">
                    <p className="font-display text-[10px] tracking-[0.14em] text-white/40">
                      {line.category.toUpperCase()}
                    </p>
                    <p className="font-mono text-xs text-white">{line.name}</p>
                    <p className="font-mono text-[11px] text-white/50">{line.displayValue}</p>
                    <div className="mt-2">
                      <ClipOutbound
                        clip={clipFor(null, { name: line.name, category: line.category })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <GamecastDepth
        teamStats={teamStats ?? []}
        playerBox={playerBox ?? { available: false, teams: [] }}
        standings={standings ?? null}
        news={news ?? { article: null, articles: [] }}
        pregame={game.status.state === "pre"}
        league={league}
      />
    </div>
  );
}
