"use client";

import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { TeamLogo } from "@/components/team-logo";
import { sportBoardHref } from "@/lib/board-url";
import { formatPollClock } from "@/lib/dates";
import { pollTabsFor, rankingsHref } from "@/lib/espn-rankings";
import { teamHref } from "@/lib/espn-team";
import { BOARD_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { LeagueId, PollId, RankingRow, RankingsResponse } from "@/lib/types";
import { ArrowLeft, ChevronDown, ChevronUp, Minus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ViewTransition } from "react";

function TrendMark({ row }: { row: RankingRow }) {
  const { direction, label } = row.trend;
  if (!direction && !label) return <span className="font-mono text-[10px] text-white/25">—</span>;
  const tone =
    direction === "up"
      ? "text-[#8ee08e]"
      : direction === "down"
        ? "text-[#ffb3b3]"
        : "text-white/45";
  return (
    <span className={`inline-flex items-center justify-end gap-0.5 font-mono text-[11px] ${tone}`}>
      {direction === "up" ? <ChevronUp className="size-3.5" aria-hidden /> : null}
      {direction === "down" ? <ChevronDown className="size-3.5" aria-hidden /> : null}
      {direction === "even" ? <Minus className="size-3.5" aria-hidden /> : null}
      <span>{label && label !== "-" ? label.replace(/^[+-]/, "") : ""}</span>
    </span>
  );
}

function RankingRowLink({ row, league }: { row: RankingRow; league: LeagueId }) {
  return (
    <Link
      href={teamHref(row.team.id, league)}
      transitionTypes={["nav-forward"]}
      className="pressable tap-row grid grid-cols-[2.25rem_28px_minmax(0,1fr)_3.25rem] items-center gap-2 px-2 no-underline sm:grid-cols-[2.75rem_32px_minmax(0,1fr)_4.5rem_3.5rem] sm:px-3"
    >
      <span className="text-right font-display text-lg leading-none tracking-wide text-[#f3c14b] sm:text-xl">
        {row.rank}
      </span>
      <ViewTransition name={`team-logo-${row.team.id}`} share="morph" default="none">
        <span className="inline-flex">
          <TeamLogo
            src={row.team.logo}
            alt=""
            abbreviation={row.team.abbreviation}
            color={row.team.color}
            size={28}
          />
        </span>
      </ViewTransition>
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] leading-none tracking-wide text-white sm:text-lg">
          {row.team.name.toUpperCase()}
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-white/45">
          {row.team.abbreviation}
          {row.record ? `  ·  ${row.record}` : ""}
        </p>
      </div>
      <span className="hidden text-right font-mono text-[11px] text-white/50 sm:block">
        {row.points != null ? row.points.toLocaleString("en-US") : ""}
      </span>
      <TrendMark row={row} />
    </Link>
  );
}

export function RankingsView({
  initial,
  initialError,
  poll,
  league = DEFAULT_LEAGUE,
}: {
  initial: RankingsResponse | null;
  initialError?: string | null;
  poll: PollId;
  league?: LeagueId;
}) {
  const [board, setBoard] = useState<RankingsResponse | null>(initial);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [localPoll, setLocalPoll] = useState<PollId>(poll);
  const tabs = pollTabsFor(league);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (league !== DEFAULT_LEAGUE) params.set("league", league);
      const qs = params.toString();
      const response = await fetch(`/api/rankings${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const payload = (await response.json()) as RankingsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Rankings request failed");
      }
      setBoard(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rankings request failed");
    }
  }, [league]);

  useLivePoll(refresh, { intervalMs: BOARD_REFRESH_MS });

  const selectPoll = (next: PollId) => {
    setLocalPoll(next);
    window.history.replaceState(null, "", rankingsHref(next, league));
  };

  const selected = board?.polls.find((item) => item.id === localPoll) ?? board?.selected ?? null;
  const lastStamp = board?.generatedAt ? formatPollClock(board.generatedAt) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-10">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0e0e0e]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={sportBoardHref(league)}
              transitionTypes={["nav-back"]}
              className="pressable inline-flex min-h-10 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70"
            >
              <ArrowLeft className="size-3.5" />
              BOARD
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="pressable inline-flex items-center gap-1 rounded-sm border border-white/15 px-2 py-1 font-display text-[10px] tracking-[0.14em] text-white/70"
            >
              <RefreshCw className="size-3" />
              REFRESH
            </button>
          </div>
          <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <FilterChip
                key={tab.id}
                href={rankingsHref(tab.id, league)}
                active={localPoll === tab.id}
                tone="red"
                className="chip-hit-lg shrink-0"
                onSelect={() => selectPoll(tab.id)}
              >
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.longLabel}</span>
              </FilterChip>
            ))}
          </div>
          <p className="font-mono text-[10px] tracking-wide text-white/50">
            {selected?.occurrence ?? (board?.week ? `WEEK ${board.week}` : "ESPN POLLS")}
            {lastStamp ? `  ·  POLLED ${lastStamp}` : ""}
            {selected?.ranks.length ? `  ·  ${selected.ranks.length} TEAMS` : ""}
          </p>
        </div>
      </div>

      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-3 py-3 pb-8 sm:px-5 sm:py-4">
        {board ? (
          <div className="board-glass mb-3 border-l-4 border-[#cc0000] px-3 py-2 sm:py-2.5">
            <p className="font-display text-[11px] tracking-[0.16em] text-[#f3c14b] sm:text-xs">
              {board.coverage.headline}
            </p>
            <p className="mt-1 hidden font-sans text-sm text-white/60 sm:block">{board.coverage.detail}</p>
            {selected?.headline ? (
              <p className="mt-1 hidden font-mono text-[10px] tracking-wide text-white/40 sm:block">
                {selected.headline}
              </p>
            ) : null}
          </div>
        ) : null}

        {!board ? (
          <EmptyState
            kicker="ESPN RANKINGS"
            headline={error ?? "RANKINGS UNAVAILABLE"}
            detail="Live poll points are never invented. If ESPN’s public rankings JSON is unreachable, this page stays empty."
          />
        ) : !selected || selected.ranks.length === 0 ? (
          <EmptyState
            kicker={selected?.name ?? "ESPN RANKINGS"}
            headline={error ?? "POLL NOT PUBLISHED"}
            detail={
              !getLeague(league).rankings
                ? "ESPN’s public rankings JSON 404s for this league. Polls are never invented."
                : selected?.headline && selected.headline !== "ESPN has not published this poll"
                ? selected.headline
                : "ESPN has not published this poll on the public rankings feed. No sample ballot is shown."
            }
          />
        ) : (
          <section className="score-cell overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <h1 className="font-display text-xs tracking-[0.18em] text-[#f3c14b] sm:text-sm">
                {selected.name.toUpperCase()}
              </h1>
              <p className="font-mono text-[10px] text-white/40">
                {selected.occurrence ?? "ESPN"}
                {board.seasonYear ? `  ·  ${board.seasonYear}` : ""}
              </p>
            </div>
            <div className="hidden grid-cols-[2.75rem_32px_minmax(0,1fr)_4.5rem_3.5rem] gap-2 border-b border-white/8 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-white/35 sm:grid">
              <span className="text-right">RK</span>
              <span />
              <span>SCHOOL</span>
              <span className="text-right">PTS</span>
              <span className="text-right">TREND</span>
            </div>
            <ol className="divide-y divide-white/5">
              {selected.ranks.map((row) => (
                <li key={`${selected.id}-${row.team.id}-${row.rank}`}>
                  <RankingRowLink row={row} league={league} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
