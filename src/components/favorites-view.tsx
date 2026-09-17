"use client";

import { EmptyState } from "@/components/empty-state";
import { FavoritePinButton } from "@/components/favorite-pin-button";
import { GameCard } from "@/components/game-card";
import { TeamLogo } from "@/components/team-logo";
import { sportBoardHref } from "@/lib/board-url";
import { teamHref } from "@/lib/espn-team";
import {
  favoriteKeySet,
  gameHasFavorite,
  groupFavoritePins,
  type FavoritePin,
} from "@/lib/favorites";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import { useFavorites } from "@/lib/use-favorites";
import type { GameSummary, LeagueId, ScoreboardResponse } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type FollowedGame = {
  league: LeagueId;
  game: GameSummary;
};

type SlateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; games: FollowedGame[] };

function PinRow({ pin }: { pin: FavoritePin }) {
  const spec = getLeague(pin.league);
  return (
    <div className="flex min-h-14 items-center gap-1 px-2 py-1.5 sm:px-3">
      <FavoritePinButton league={pin.league} team={pin} />
      <Link
        href={teamHref(pin.teamId, pin.league)}
        transitionTypes={["nav-forward"]}
        className="pressable tap-row flex min-h-12 min-w-0 flex-1 items-center gap-2 px-1 no-underline"
      >
        <TeamLogo src={pin.logo} alt="" abbreviation={pin.abbreviation} color={pin.color} size={28} />
        <div className="min-w-0">
          <p className="truncate font-display text-base tracking-wide text-white sm:text-lg">
            {pin.name.toUpperCase()}
          </p>
          <p className="truncate font-mono text-[10px] text-white/45">
            {spec.shortLabel}  ·  {pin.abbreviation}
          </p>
        </div>
      </Link>
    </div>
  );
}

export function FavoritesView({ league = DEFAULT_LEAGUE }: { league?: LeagueId }) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { snapshot } = useFavorites();
  const groups = useMemo(
    () => groupFavoritePins(snapshot.pins, league),
    [snapshot.pins, league]
  );
  const [slate, setSlate] = useState<SlateState>({ status: "idle" });

  useEffect(() => {
    const leagues = [...new Set(snapshot.pins.map((pin) => pin.league))];
    if (leagues.length === 0) {
      setSlate({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSlate({ status: "loading" });

    void Promise.all(
      leagues.map(async (id) => {
        const params = new URLSearchParams();
        if (id !== DEFAULT_LEAGUE) params.set("league", id);
        if (id === "nfl") params.set("view", "week");
        const response = await fetch(`/api/scoreboard?${params}`, { cache: "no-store" });
        const payload = (await response.json()) as ScoreboardResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Scoreboard request failed");
        }
        const keys = favoriteKeySet(snapshot.pins.filter((pin) => pin.league === id));
        return (payload.games ?? [])
          .filter((game) => gameHasFavorite(game, id, keys))
          .map((game) => ({ league: id, game }));
      })
    )
      .then((rows) => {
        if (cancelled) return;
        setSlate({ status: "ready", games: rows.flat() });
      })
      .catch((err) => {
        if (cancelled) return;
        setSlate({
          status: "error",
          message: err instanceof Error ? err.message : "Scoreboard request failed",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [snapshot.pins]);

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
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
          THIS BROWSER  ·  NO ACCOUNT  ·  demo: false
        </p>
      </div>

      {!hydrated ? (
        <p className="px-1 py-6 font-mono text-[11px] text-white/50">Loading followed teams…</p>
      ) : snapshot.pins.length === 0 ? (
        <EmptyState
          kicker="FOLLOWED TEAMS"
          headline="NO TEAMS PINNED"
          detail="Star a school or club on a team page or game card. Pins live in this browser only — no account, no sample list. Scores are never invented."
          action={
            <Link
              href={sportBoardHref(league)}
              className="pressable inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
            >
              BACK TO THE BOARD
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const spec = getLeague(group.league);
            return (
              <section key={group.league} className="board-glass">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                  <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">
                    {spec.label.toUpperCase()}
                  </h2>
                  <p className="font-mono text-[10px] text-white/40">
                    {group.pins.length} PINNED
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {group.pins.map((pin) => (
                    <PinRow key={`${pin.league}:${pin.teamId}`} pin={pin} />
                  ))}
                </div>
              </section>
            );
          })}

          <section className="board-glass">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">
                ON THIS SLATE
              </h2>
              <p className="font-mono text-[10px] text-white/40">ESPN PUBLIC FEED</p>
            </div>
            {slate.status === "loading" || slate.status === "idle" ? (
              <p className="px-3 py-4 font-mono text-[11px] text-white/50">Loading followed games…</p>
            ) : slate.status === "error" ? (
              <EmptyState
                className="border-0 bg-transparent shadow-none"
                kicker="ESPN FEED"
                headline="SLATE UNAVAILABLE"
                detail="The public scoreboard did not load. Followed teams stay pinned. Scores are never invented."
              />
            ) : slate.games.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent shadow-none"
                kicker="ESPN FEED"
                headline="NO FOLLOWED GAMES ON THIS SLATE"
                detail="None of your pinned teams are on the current ESPN board. Try another date or week from the scoreboard — empty stays empty."
                action={
                  <Link
                    href={sportBoardHref(league)}
                    className="pressable inline-block font-display text-xs tracking-[0.16em] text-[#f3c14b]"
                  >
                    OPEN THE BOARD
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 p-3 sm:grid-cols-2">
                {slate.games.map(({ league: gameLeague, game }) => (
                  <GameCard
                    key={`${gameLeague}-${game.id}`}
                    game={game}
                    league={gameLeague}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
