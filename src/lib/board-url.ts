import { DEFAULT_LEAGUE } from "@/lib/leagues";
import type { DivisionId, LeagueId, StatusFilter, SubdivisionId } from "@/lib/types";

export function boardHref(options: {
  division: DivisionId;
  date: string;
  subdivision?: SubdivisionId;
  conference?: string;
  status?: StatusFilter;
  q?: string;
  week?: number | null;
  year?: number | null;
  league?: LeagueId;
}): string {
  const params = new URLSearchParams();
  params.set("division", options.division);
  params.set("date", options.date);
  if (options.week && options.week > 0) {
    params.set("week", String(options.week));
    if (options.year && options.year > 0) {
      params.set("year", String(options.year));
    }
  }
  if (options.division === "d1" && options.subdivision && options.subdivision !== "all") {
    params.set("subdivision", options.subdivision);
  }
  if (options.conference && options.conference !== "all") {
    params.set("conference", options.conference);
  }
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  const query = options.q?.trim();
  if (query) params.set("q", query);
  if (options.league && options.league !== DEFAULT_LEAGUE) {
    params.set("league", options.league);
  }
  return `/?${params.toString()}`;
}

export function gameHref(gameId: string, league: LeagueId = DEFAULT_LEAGUE): string {
  const path = `/game/${encodeURIComponent(gameId)}`;
  return league === DEFAULT_LEAGUE ? path : `${path}?league=${league}`;
}

export function parseStatusFilter(value: string | null | undefined): StatusFilter {
  if (value === "live" || value === "final" || value === "upcoming" || value === "all") {
    return value;
  }
  return "all";
}

export function sportBoardHref(league: LeagueId): string {
  return league === DEFAULT_LEAGUE ? "/" : `/?league=${league}`;
}

export function sportRankingsHref(league: LeagueId): string {
  return league === DEFAULT_LEAGUE ? "/rankings" : `/rankings?league=${league}`;
}
