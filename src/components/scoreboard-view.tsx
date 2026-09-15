"use client";

import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { GameCard } from "@/components/game-card";
import { BottomLine } from "@/components/ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekStrip } from "@/components/week-strip";
import { boardHref, parseStatusFilter } from "@/lib/board-url";
import { formatBoardDate, formatPollClock, shiftEspnDate } from "@/lib/dates";
import { BOARD_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import type {
  DivisionId,
  ScoreboardResponse,
  ScoreboardView,
  ScoreboardWeek,
  StatusFilter,
  SubdivisionId,
} from "@/lib/types";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DIVISIONS: { id: DivisionId; label: string; hint: string }[] = [
  { id: "d1", label: "DIV I", hint: "FBS + FCS" },
  { id: "d2", label: "DIV II", hint: "NCAA D2" },
  { id: "naia", label: "NAIA", hint: "Partial feed" },
];

function filterGames(
  board: ScoreboardResponse | null,
  conference: string,
  status: StatusFilter,
  query: string
) {
  if (!board) return [];
  const q = query.trim().toLowerCase();
  return board.games.filter((game) => {
    if (conference !== "all") {
      const match =
        game.away.conferenceId === conference || game.home.conferenceId === conference;
      if (!match) return false;
    }
    if (status === "live" && game.status.state !== "in") return false;
    if (status === "final" && game.status.state !== "post") return false;
    if (status === "upcoming" && game.status.state !== "pre") return false;
    if (!q) return true;
    const hay = [
      game.name,
      game.shortName,
      game.away.name,
      game.home.name,
      game.away.shortName,
      game.home.shortName,
      game.away.abbreviation,
      game.home.abbreviation,
      game.venue ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function ScoreboardView({
  initial,
  initialError,
  date,
  division,
  subdivision,
  conference,
  status,
  query,
  week,
  year,
  view,
}: {
  initial: ScoreboardResponse | null;
  initialError?: string | null;
  date: string;
  division: DivisionId;
  subdivision: SubdivisionId;
  conference: string;
  status: StatusFilter;
  query: string;
  week: number | null;
  year: number | null;
  view: ScoreboardView;
}) {
  const [board, setBoard] = useState<ScoreboardResponse | null>(initial);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [updatedAt, setUpdatedAt] = useState(initial?.generatedAt ?? null);
  const [localConference, setLocalConference] = useState(conference);
  const [localStatus, setLocalStatus] = useState(status);
  const [localQuery, setLocalQuery] = useState(query);
  const queryTimer = useRef<number | null>(null);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setLocalConference(params.get("conference") ?? "all");
      setLocalStatus(parseStatusFilter(params.get("status")));
      setLocalQuery(params.get("q") ?? "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        division,
        date,
        subdivision,
      });
      if (view === "week" && week) {
        params.set("week", String(week));
        if (year) params.set("year", String(year));
      }
      const response = await fetch(`/api/scoreboard?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as ScoreboardResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Scoreboard request failed");
      }
      setBoard(payload);
      setUpdatedAt(payload.generatedAt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoreboard request failed");
    }
  }, [date, division, subdivision, view, week, year]);

  useLivePoll(refresh, { intervalMs: BOARD_REFRESH_MS });

  const games = useMemo(
    () => filterGames(board, localConference, localStatus, localQuery),
    [board, localConference, localStatus, localQuery]
  );

  const hrefFor = (next: {
    date?: string;
    division?: DivisionId;
    subdivision?: SubdivisionId;
    conference?: string;
    status?: StatusFilter;
    q?: string;
    week?: number | null;
    year?: number | null;
    view?: ScoreboardView;
  }) => {
    const nextDate = next.date ?? date;
    const nextView = next.view ?? (next.date && next.week === undefined ? "date" : view);
    const nextWeek = nextView === "week" ? (next.week ?? week) : null;
    const nextYear =
      nextWeek != null
        ? (next.year ?? year ?? Number(nextDate.slice(0, 4)))
        : null;
    return boardHref({
      division: next.division ?? division,
      date: nextDate,
      subdivision: next.subdivision ?? subdivision,
      conference: next.conference ?? localConference,
      status: next.status ?? localStatus,
      q: next.q ?? localQuery,
      week: nextWeek,
      year: nextYear,
    });
  };

  const weeks = board?.weeks ?? [];
  const seasonYear = board?.seasonYear ?? year ?? Number(date.slice(0, 4));
  const selectedWeek = (view === "week" ? week : null) ?? board?.week ?? week;

  const weekHref = (entry: ScoreboardWeek) =>
    hrefFor({
      date: entry.startEspnDate,
      week: entry.number,
      year: seasonYear,
      view: "week",
    });

  const applyClientFilter = (next: {
    conference?: string;
    status?: StatusFilter;
    q?: string;
  }) => {
    if (next.conference !== undefined) setLocalConference(next.conference);
    if (next.status !== undefined) setLocalStatus(next.status);
    if (next.q !== undefined) setLocalQuery(next.q);
    window.history.replaceState(
      null,
      "",
      hrefFor({
        conference: next.conference ?? localConference,
        status: next.status ?? localStatus,
        q: next.q ?? localQuery,
      })
    );
  };

  const onQueryChange = (value: string) => {
    setLocalQuery(value);
    if (queryTimer.current) window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => {
      window.history.replaceState(
        null,
        "",
        hrefFor({
          conference: localConference,
          status: localStatus,
          q: value,
        })
      );
    }, 180);
  };

  const live = board?.liveCount ?? 0;
  const lastStamp = updatedAt ? formatPollClock(updatedAt) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-14">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0e0e0e]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center gap-2">
            {DIVISIONS.map((item) => {
              const active = division === item.id;
              return (
                <FilterChip
                  key={item.id}
                  href={hrefFor({
                    division: item.id,
                    subdivision: "all",
                    conference: "all",
                  })}
                  active={active}
                  tone="red"
                >
                  {item.label}
                  <span className="ml-2 hidden font-mono text-[10px] tracking-normal text-white/60 sm:inline">
                    {item.hint}
                  </span>
                </FilterChip>
              );
            })}

            {division === "d1" && (
              <div className="ml-auto flex items-center gap-1 sm:ml-4">
                {(
                  [
                    ["all", "ALL"],
                    ["fbs", "FBS"],
                    ["fcs", "FCS"],
                  ] as const
                ).map(([id, label]) => (
                  <FilterChip
                    key={id}
                    href={hrefFor({ subdivision: id })}
                    active={subdivision === id}
                    tone="inverse"
                    className="font-mono text-[10px] tracking-[0.14em]"
                  >
                    {label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <WeekStrip weeks={weeks} selectedWeek={selectedWeek} hrefFor={weekHref} />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <Link
                href={hrefFor({ date: shiftEspnDate(date, -1), view: "date" })}
                aria-label="Previous day"
                className="pressable inline-flex size-11 items-center justify-center rounded-sm border border-white/15 bg-black/70 text-white sm:size-8"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <p className="px-1.5 font-mono text-[11px] text-white/70">
                {formatBoardDate(date)}
                {view === "week" && selectedWeek ? (
                  <span className="ml-2 text-[#f3c14b]">WK {selectedWeek} SLATE</span>
                ) : null}
              </p>
              <Link
                href={hrefFor({ date: shiftEspnDate(date, 1), view: "date" })}
                aria-label="Next day"
                className="pressable inline-flex size-11 items-center justify-center rounded-sm border border-white/15 bg-black/70 text-white sm:size-8"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  ["all", "ALL", "inverse"],
                  ["live", "LIVE", "live"],
                  ["upcoming", "UPCOMING", "inverse"],
                  ["final", "FINAL", "inverse"],
                ] as const
              ).map(([id, label, tone]) => (
                <FilterChip
                  key={id}
                  href={hrefFor({ status: id })}
                  active={localStatus === id}
                  tone={tone}
                  className="font-mono text-[10px] tracking-[0.14em]"
                  onSelect={() => applyClientFilter({ status: id })}
                >
                  {label}
                </FilterChip>
              ))}
            </div>

            <form
              action="/"
              method="get"
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                applyClientFilter({ q: localQuery });
              }}
            >
              <input type="hidden" name="division" value={division} />
              <input type="hidden" name="date" value={date} />
              {view === "week" && week ? <input type="hidden" name="week" value={week} /> : null}
              {view === "week" && year ? <input type="hidden" name="year" value={year} /> : null}
              {subdivision !== "all" ? (
                <input type="hidden" name="subdivision" value={subdivision} />
              ) : null}
              {localConference !== "all" ? (
                <input type="hidden" name="conference" value={localConference} />
              ) : null}
              {localStatus !== "all" ? (
                <input type="hidden" name="status" value={localStatus} />
              ) : null}
              <label className="sr-only" htmlFor="team-search">
                Find a team
              </label>
              <input
                id="team-search"
                type="search"
                name="q"
                placeholder="Find a team…"
                value={localQuery}
                onChange={(event) => onQueryChange(event.target.value)}
                className="board-search min-w-0 flex-1 rounded-sm px-2.5 font-mono text-xs placeholder:text-white/35"
              />
              <button
                type="submit"
                className="pressable h-8 rounded-sm bg-[#cc0000] px-3 font-display text-xs tracking-[0.14em] text-white shadow-[0_0_14px_rgb(204_0_0_/_28%)] sm:h-9"
              >
                FIND
              </button>
            </form>
          </div>

          {(board?.conferences.length ?? 0) > 0 ? (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              <FilterChip
                href={hrefFor({ conference: "all" })}
                active={localConference === "all"}
                tone="inverse"
                className="shrink-0 font-mono text-[10px] tracking-[0.12em]"
                onSelect={() => applyClientFilter({ conference: "all" })}
              >
                ALL CONF
              </FilterChip>
              {board?.conferences.map((item) => (
                <FilterChip
                  key={item.id}
                  href={hrefFor({ conference: item.id })}
                  active={localConference === item.id}
                  tone="red"
                  className="shrink-0 font-mono text-[10px] tracking-[0.12em]"
                  onSelect={() => applyClientFilter({ conference: item.id })}
                >
                  {(item.abbreviation ?? item.name).toUpperCase()}
                </FilterChip>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-wide text-white/50">
            <p className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="live-pill font-display text-[10px] tracking-[0.16em]">
                <span className={live > 0 ? "live-dot" : "live-dot live-dot-idle"} />
                {live} LIVE
              </span>
              <span className="hidden sm:inline">
                {board ? `${games.length} shown / ${board.games.length} on board` : "Loading"}
                {localConference !== "all" || localStatus !== "all" || localQuery.trim()
                  ? "  ·  FILTERED"
                  : ""}
                {lastStamp ? `  ·  POLLED ${lastStamp}` : ""}
              </span>
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
      </div>

      <main className="page-enter mx-auto w-full max-w-6xl flex-1 px-3 py-3 pb-6 sm:px-5 sm:py-4">
        {board ? (
          <div className="board-glass mb-3 hidden border-l-4 border-[#cc0000] px-3 py-2.5 sm:mb-4 sm:block">
            <p className="font-display text-xs tracking-[0.16em] text-[#f3c14b]">
              {board.coverage.headline}
            </p>
            <p className="mt-1 font-sans text-[13px] leading-relaxed text-white/62">
              {board.coverage.detail}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 border border-[#cc0000] bg-[#2a0000]/90 px-3 py-3 shadow-[0_0_24px_rgb(80_0_0_/_35%)]">
            <p className="font-display text-sm tracking-[0.12em] text-[#ffb3b3]">
              SCOREBOARD FEED ERROR
            </p>
            <p className="mt-1 font-mono text-xs text-white/70">{error}</p>
            <p className="mt-2 font-mono text-[11px] text-white/50">
              No sample scores are invented. Retrying on the next poll.
            </p>
          </div>
        ) : null}

        {!board && !error ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-none bg-white/8" />
            ))}
          </div>
        ) : null}

        {board && games.length === 0 ? (
          <EmptyState
            kicker={board.games.length === 0 ? "ESPN FEED" : "FILTERED BOARD"}
            headline="NO GAMES MATCH THIS BOARD"
            detail={
              board.games.length === 0
                ? division === "naia"
                  ? "ESPN’s NAIA group is quiet for this date. Many NAIA-only games never appear here. Try another Saturday or check D1/D2."
                  : view === "week"
                    ? "ESPN has no college football games for this week for the selected division."
                    : "ESPN has no college football games on this date for the selected division."
                : "Clear the conference, status, or search filter to see the rest of the slate."
            }
            action={
              board.games.length === 0 ? (
                view === "week" && selectedWeek && selectedWeek > 1 ? (
                  <Link
                    href={hrefFor({
                      week: selectedWeek - 1,
                      year: seasonYear,
                      view: "week",
                      date:
                        weeks.find((entry) => entry.number === selectedWeek - 1)?.startEspnDate ??
                        shiftEspnDate(date, -7),
                    })}
                    className="pressable inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
                  >
                    TRY PREVIOUS WEEK
                  </Link>
                ) : (
                  <Link
                    href={hrefFor({ date: shiftEspnDate(date, -1), view: "date" })}
                    className="pressable inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
                  >
                    TRY PREVIOUS DAY
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => applyClientFilter({ conference: "all", status: "all", q: "" })}
                  className="pressable inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
                >
                  CLEAR FILTERS
                </button>
              )
            }
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>

      <BottomLine games={games} />
    </div>
  );
}
