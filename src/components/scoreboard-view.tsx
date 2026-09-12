"use client";

import { GameCard } from "@/components/game-card";
import { BottomLine } from "@/components/ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { boardHref } from "@/lib/board-url";
import { formatBoardDate, shiftEspnDate } from "@/lib/dates";
import { useLivePoll } from "@/lib/hooks";
import type {
  DivisionId,
  ScoreboardResponse,
  StatusFilter,
  SubdivisionId,
} from "@/lib/types";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

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
}: {
  initial: ScoreboardResponse | null;
  initialError?: string | null;
  date: string;
  division: DivisionId;
  subdivision: SubdivisionId;
  conference: string;
  status: StatusFilter;
  query: string;
}) {
  const [board, setBoard] = useState<ScoreboardResponse | null>(initial);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [updatedAt, setUpdatedAt] = useState(initial?.generatedAt ?? null);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        division,
        date,
        subdivision,
      });
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
  }, [date, division, subdivision]);

  useLivePoll(refresh, {
    live: Boolean(board?.liveCount),
    liveMs: 12_000,
    idleMs: 40_000,
  });

  const games = useMemo(
    () => filterGames(board, conference, status, query),
    [board, conference, status, query]
  );

  const hrefFor = (next: {
    date?: string;
    division?: DivisionId;
    subdivision?: SubdivisionId;
    conference?: string;
    status?: StatusFilter;
    q?: string;
  }) =>
    boardHref({
      division: next.division ?? division,
      date: next.date ?? date,
      subdivision: next.subdivision ?? subdivision,
      conference: next.conference ?? conference,
      status: next.status ?? status,
      q: next.q ?? query,
    });

  const live = board?.liveCount ?? 0;
  const lastStamp = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-14">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0e0e0e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {DIVISIONS.map((item) => {
              const active = division === item.id;
              return (
                <Link
                  key={item.id}
                  href={hrefFor({
                    division: item.id,
                    subdivision: "all",
                    conference: "all",
                  })}
                  className={`rounded-sm border px-3 py-1.5 font-display text-sm tracking-[0.16em] no-underline ${
                    active
                      ? "border-[#cc0000] bg-[#cc0000] text-white"
                      : "border-white/15 bg-black text-white/70 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {item.label}
                  <span className="ml-2 hidden font-mono text-[10px] tracking-normal text-white/60 sm:inline">
                    {item.hint}
                  </span>
                </Link>
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
                  <Link
                    key={id}
                    href={hrefFor({ subdivision: id })}
                    className={`rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.14em] no-underline ${
                      subdivision === id
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <Link
                href={hrefFor({ date: shiftEspnDate(date, -1) })}
                aria-label="Previous day"
                className="inline-flex size-7 items-center justify-center rounded-sm border border-white/15 bg-black text-white hover:border-white/40"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <p className="px-1 font-mono text-[11px] text-white/70">{formatBoardDate(date)}</p>
              <Link
                href={hrefFor({ date: shiftEspnDate(date, 1) })}
                aria-label="Next day"
                className="inline-flex size-7 items-center justify-center rounded-sm border border-white/15 bg-black text-white hover:border-white/40"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  ["all", "ALL"],
                  ["live", "LIVE"],
                  ["upcoming", "UPCOMING"],
                  ["final", "FINAL"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  href={hrefFor({ status: id })}
                  className={`rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.14em] no-underline ${
                    status === id ? "bg-white text-black" : "text-white/55 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <form
              action="/api/board"
              method="get"
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              <input type="hidden" name="division" value={division} />
              <input type="hidden" name="date" value={date} />
              {subdivision !== "all" ? (
                <input type="hidden" name="subdivision" value={subdivision} />
              ) : null}
              {conference !== "all" ? (
                <input type="hidden" name="conference" value={conference} />
              ) : null}
              {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
              <label className="sr-only" htmlFor="team-search">
                Find a team
              </label>
              <input
                id="team-search"
                type="search"
                name="q"
                placeholder="Find a team…"
                defaultValue={query}
                className="h-8 min-w-0 flex-1 rounded-sm border border-white/15 bg-black px-2 font-mono text-xs text-white placeholder:text-white/35"
              />
              <button
                type="submit"
                className="h-8 rounded-sm bg-[#cc0000] px-3 font-display text-xs tracking-[0.14em] text-white"
              >
                FIND
              </button>
            </form>
          </div>

          {(board?.conferences.length ?? 0) > 0 ? (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              <Link
                href={hrefFor({ conference: "all" })}
                className={`shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.12em] no-underline ${
                  conference === "all" ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                ALL CONF
              </Link>
              {board?.conferences.map((item) => (
                <Link
                  key={item.id}
                  href={hrefFor({ conference: item.id })}
                  className={`shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.12em] no-underline ${
                    conference === item.id
                      ? "bg-[#cc0000] text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {(item.abbreviation ?? item.name).toUpperCase()}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-wide text-white/50">
            <p className="flex items-center gap-2">
              <Radio className="size-3 text-[#ff3b3b]" />
              {live} LIVE ON FEED
              <span className="text-white/25">|</span>
              {board ? `${games.length} shown / ${board.games.length} on board` : "Loading"}
              {conference !== "all" || status !== "all" || query.trim() ? (
                <>
                  <span className="text-white/25">|</span>
                  FILTERED
                </>
              ) : null}
              {lastStamp ? (
                <>
                  <span className="text-white/25">|</span>
                  POLLED {lastStamp}
                </>
              ) : null}
            </p>
            <p className="text-[#f3c14b]/80">{formatBoardDate(date)}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-5">
        {board ? (
          <div className="mb-4 border-l-4 border-[#cc0000] bg-[#161616] px-3 py-2">
            <p className="font-display text-xs tracking-[0.16em] text-[#f3c14b]">
              {board.coverage.headline}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">
              {board.coverage.detail}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 border border-[#cc0000] bg-[#2a0000] px-3 py-3">
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
          <div className="border border-white/10 bg-[#111] px-4 py-10 text-center">
            <p className="font-display text-xl tracking-[0.14em] text-white">
              NO GAMES MATCH THIS BOARD
            </p>
            <p className="mx-auto mt-2 max-w-lg font-mono text-xs leading-relaxed text-white/55">
              {board.games.length === 0
                ? division === "naia"
                  ? "ESPN’s NAIA group is quiet for this date. Many NAIA-only games never appear here. Try another Saturday or check D1/D2."
                  : "ESPN has no college football games on this date for the selected division."
                : "Clear the conference, status, or search filter to see the rest of the slate."}
            </p>
            <Link
              href={hrefFor({ conference: "all", status: "all", q: "" })}
              className="mt-4 inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
            >
              CLEAR FILTERS
            </Link>
          </div>
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
