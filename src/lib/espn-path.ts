import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";

export const DEFAULT_ESPN_WEB_ORIGIN = "https://site.web.api.espn.com";
export const DEFAULT_ESPN_SITE_ORIGIN = "https://site.api.espn.com";
export const ESPN_SITE_V2_PREFIX = "/apis/site/v2";

/** Host-only origin. Legacy full CFB paths are stripped so the registry can append sport/league. */
export function originFromEnv(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return fallback;
  }
}

export function espnSportPath(league: LeagueId = DEFAULT_LEAGUE): string {
  const spec = getLeague(league);
  return `${ESPN_SITE_V2_PREFIX}/sports/${spec.sport}/${spec.league}`;
}

export function espnRequestUrl(
  origin: string,
  league: LeagueId,
  path: string
): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${espnSportPath(league)}${suffix}`;
}

export function teamLogoUrl(
  teamId: string,
  league: LeagueId = DEFAULT_LEAGUE,
  abbreviation?: string | null
): string {
  const ns = getLeague(league).logoNamespace;
  const token =
    ns === "ncaa"
      ? teamId
      : (abbreviation ?? "").trim().toLowerCase() || teamId.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/${ns}/500/${token}.png`;
}
