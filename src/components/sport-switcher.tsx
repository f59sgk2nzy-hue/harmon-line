import { DEFAULT_LEAGUE, getLeague, shippedLeagues } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";

/** Dormant until a second league is shipped (Phase 1 MBB). CFB badge stays as-is. */
export function SportSwitcher({
  current = DEFAULT_LEAGUE,
}: {
  current?: LeagueId;
}) {
  const league = getLeague(current);
  const shipped = shippedLeagues();

  return (
    <span
      className="hidden rounded-sm bg-black/30 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-white/90 ring-1 ring-white/15 sm:inline"
      data-sport-switcher={shipped.length > 1 ? "ready" : "dormant"}
      data-league={league.id}
    >
      {league.shortLabel}
    </span>
  );
}
