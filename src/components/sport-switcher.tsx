import {
  sportBoardHref,
  sportFavoritesHref,
  sportOracleHref,
  sportRankingsHref,
  sportResearchHref,
  sportStandingsHref,
} from "@/lib/board-url";
import { DEFAULT_LEAGUE, LEAGUE_IDS, getLeague, shippedLeagues } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HEADER_ORDER: Record<LeagueId, number> = {
  cfb: 0,
  mbb: 1,
  nfl: 2,
  nba: 3,
  mlb: 4,
};

function byHeaderOrder<T extends { id: LeagueId }>(a: T, b: T) {
  return HEADER_ORDER[a.id] - HEADER_ORDER[b.id];
}

export function SportSwitcher({
  current = DEFAULT_LEAGUE,
  section = "board",
}: {
  current?: LeagueId;
  section?: "board" | "rankings" | "standings" | "favorites" | "game" | "team" | "ops" | "oracle" | "research";
}) {
  const shipped = shippedLeagues().slice().sort(byHeaderOrder);
  const hrefFor = (id: LeagueId) => {
    if (section === "rankings" && !getLeague(id).rankings) return sportBoardHref(id);
    if (section === "rankings") return sportRankingsHref(id);
    if (section === "standings" && !getLeague(id).standings) return sportBoardHref(id);
    if (section === "standings") return sportStandingsHref(id);
    if (section === "favorites") return sportFavoritesHref(id);
    if (section === "oracle") return sportOracleHref(id);
    if (section === "research") return sportResearchHref(id);
    return sportBoardHref(id);
  };

  if (shipped.length < 2) {
    const league = getLeague(current);
    return (
      <span
        className="hidden rounded-sm bg-black/30 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-white/90 ring-1 ring-white/15 sm:inline"
        data-sport-switcher="dormant"
        data-league={league.id}
      >
        {league.shortLabel}
      </span>
    );
  }

  const dormant = LEAGUE_IDS.map((id) => getLeague(id))
    .filter((league) => !league.shipped)
    .sort(byHeaderOrder);

  return (
    <nav
      aria-label="Sport"
      data-sport-switcher="ready"
      data-league={current}
      className="flex items-center gap-1"
    >
      {shipped.map((league) => {
        const active = league.id === current;
        return (
          <Link
            key={league.id}
            href={hrefFor(league.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "pressable inline-flex min-h-8 min-w-8 items-center justify-center rounded-sm px-1.5 font-mono text-[10px] tracking-[0.16em] no-underline sm:min-h-7",
              active
                ? "bg-white text-black"
                : "bg-black/30 text-white/80 ring-1 ring-white/15"
            )}
          >
            {league.shortLabel}
          </Link>
        );
      })}
      {dormant.map((league) => (
        <span
          key={league.id}
          title={`${league.label} is not on The Harmon Line yet`}
          aria-disabled="true"
          className="hidden cursor-not-allowed rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-[0.16em] text-white/25 sm:inline"
        >
          {league.shortLabel}
        </span>
      ))}
    </nav>
  );
}
