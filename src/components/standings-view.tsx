"use client";

import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { TeamLogo } from "@/components/team-logo";
import { withBasePath } from "@/lib/base-path";
import { sportBoardHref, sportStandingsHref } from "@/lib/board-url";
import { formatPollClock } from "@/lib/dates";
import { teamHref } from "@/lib/espn-team";
import { BOARD_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { LeagueId, StandingsEntry, StandingsResponse, StandingsTable } from "@/lib/types";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ViewTransition } from "react";

function StandingsRowLink({
  row,
  columns,
  league,
}: {
  row: StandingsEntry;
  columns: StandingsTable["columns"];
  league: LeagueId;
}) {
  return (
    <Link
      href={teamHref(row.team.id, league)}
      transitionTypes={["nav-forward"]}
      className="pressable tap-row grid items-center gap-2 px-2 no-underline sm:px-3"
      style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${Math.max(columns.length, 1)}, 3.25rem)` }}
    >
      <div className="flex min-w-0 items-center gap-2">
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
          <p className="mt-1 truncate font-mono text-[10px] text-white/45">{row.team.abbreviation}</p>
        </div>
      </div>
      {columns.map((col) => (
        <span key={col.key} className="text-right font-mono text-[11px] tabular-nums text-white/80">
          {row.stats[col.key] ?? ""}
        </span>
      ))}
    </Link>
  );
}

function StandingsTableCard({ table, league }: { table: StandingsTable; league: LeagueId }) {
  const columns = table.columns;
  return (
    <section className="score-cell overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b] sm:text-sm">
          {table.name.toUpperCase()}
        </h2>
        <p className="font-mono text-[10px] text-white/40">
          {table.abbreviation ? `${table.abbreviation.toUpperCase()}  ·  ` : ""}
          {table.entries.length} TEAMS
        </p>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[22rem] gap-2 border-b border-white/8 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-white/35"
          style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${Math.max(columns.length, 1)}, 3.25rem)` }}
        >
          <span>TEAM</span>
          {columns.map((col) => (
            <span key={col.key} className="text-right">
              {col.label}
            </span>
          ))}
        </div>
        <ol className="divide-y divide-white/5">
          {table.entries.map((row) => (
            <li key={`${table.id}-${row.team.id}`}>
              <StandingsRowLink row={row} columns={columns} league={league} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function StandingsView({
  initial,
  initialError,
  conference,
  league = DEFAULT_LEAGUE,
}: {
  initial: StandingsResponse | null;
  initialError?: string | null;
  conference: string;
  league?: LeagueId;
}) {
  const [board, setBoard] = useState<StandingsResponse | null>(initial);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [localConference, setLocalConference] = useState(conference);
  const spec = getLeague(league);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (league !== DEFAULT_LEAGUE) params.set("league", league);
      if (localConference !== "all") params.set("conference", localConference);
      const qs = params.toString();
      const response = await fetch(withBasePath(`/api/standings${qs ? `?${qs}` : ""}`), {
        cache: "no-store",
      });
      const payload = (await response.json()) as StandingsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Standings request failed");
      }
      setBoard(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Standings request failed");
    }
  }, [league, localConference]);

  useLivePoll(refresh, { intervalMs: BOARD_REFRESH_MS });

  const selectConference = (next: string) => {
    setLocalConference(next);
    window.history.replaceState(null, "", sportStandingsHref(league, next));
  };

  const lastStamp = board?.generatedAt ? formatPollClock(board.generatedAt) : null;
  const groups =
    localConference === "all"
      ? (board?.groups ?? [])
      : (board?.groups ?? []).filter((group) => group.id === localConference);
  const tabs = board?.conferences ?? [];

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
          {tabs.length > 0 ? (
            <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
              <FilterChip
                href={sportStandingsHref(league)}
                active={localConference === "all"}
                tone="red"
                className="chip-hit-lg shrink-0"
                onSelect={() => selectConference("all")}
              >
                ALL
              </FilterChip>
              {tabs.map((tab) => (
                <FilterChip
                  key={tab.id}
                  href={sportStandingsHref(league, tab.id)}
                  active={localConference === tab.id}
                  tone="red"
                  className="chip-hit-lg shrink-0"
                  onSelect={() => selectConference(tab.id)}
                >
                  <span className="sm:hidden">{(tab.abbreviation ?? tab.name).toUpperCase()}</span>
                  <span className="hidden sm:inline">{tab.name.toUpperCase()}</span>
                </FilterChip>
              ))}
            </div>
          ) : null}
          <p className="font-mono text-[10px] tracking-wide text-white/50">
            {board?.groupName?.toUpperCase() ?? `${spec.shortLabel} STANDINGS`}
            {board?.seasonYear ? `  ·  ${board.seasonYear}` : ""}
            {lastStamp ? `  ·  POLLED ${lastStamp}` : ""}
            {groups.length ? `  ·  ${groups.reduce((sum, group) => sum + group.entries.length, 0)} TEAMS` : ""}
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
          </div>
        ) : null}

        {!board ? (
          <EmptyState
            kicker="ESPN STANDINGS"
            headline={error ?? "STANDINGS UNAVAILABLE"}
            detail="Live conference records are never invented. If ESPN’s public standings JSON is unreachable, this page stays empty."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            kicker={`${spec.shortLabel} STANDINGS`}
            headline={error ?? "NO ROWS PUBLISHED"}
            detail={
              !spec.standings
                ? "ESPN’s public standings JSON is not wired for this league. Records are never invented."
                : localConference !== "all"
                  ? "ESPN’s public standings JSON published no rows for this conference. Records are never invented."
                  : board.coverage.detail
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((table) => (
              <StandingsTableCard key={table.id} table={table} league={league} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
