import { getLeague, parseLeagueParam } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";
import { HIGHLIGHTS_EMPTY_HEADLINE, type HighlightsResponse } from "@/lib/youtube";

export { HIGHLIGHTS_EMPTY_HEADLINE };

/**
 * Home-board highlights are a league feed, not a scoreboard accessory.
 * Empty ESPN slates (off-days, empty weeks) still mount the strip.
 */
export function shouldRenderHomeHighlightsStrip(input: {
  league?: LeagueId | string | null;
  gameCount?: number;
}): boolean {
  void input.gameCount;
  return getLeague(input.league).shipped;
}

/** League only — date/week/games must never gate the YouTube request. */
export function homeHighlightsQuery(input: {
  league?: LeagueId | string | null;
  date?: string | null;
  week?: number | null;
  games?: readonly unknown[] | null;
}): { league: LeagueId } {
  void input.date;
  void input.week;
  void input.games;
  return { league: parseLeagueParam(input.league) };
}

export function homeHighlightsApiPath(league?: LeagueId | string | null): string {
  return `/api/highlights?league=${encodeURIComponent(parseLeagueParam(league))}`;
}

export function highlightsStripMode(
  board: HighlightsResponse | null | undefined
): "loading" | "clips" | "empty-chrome" {
  if (!board) return "loading";
  if (board.videos.length === 0) return "empty-chrome";
  return "clips";
}

/** Empty SSR still retries on the client so an off-day YouTube timeout can recover. */
export function highlightsClientPollOnMount(
  initial?: HighlightsResponse | null
): boolean {
  return !initial || initial.videos.length === 0;
}
