import type { CoverageNote, TeamSeasonStats } from "@/lib/types";

const CFBD_BASE = "https://api.collegefootballdata.com";
const FETCH_TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export function cfbdKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CFBD_API_KEY?.trim());
}

const STAT_MAP: Record<string, keyof TeamSeasonStats> = {
  pointsPerGame: "pointsPerGame",
  totalPointsPerGame: "pointsPerGame",
  pointsAllowedPerGame: "pointsAllowedPerGame",
  rushingYardsPerGame: "rushingYardsPerGame",
  netPassingYardsPerGame: "passingYardsPerGame",
  passingYardsPerGame: "passingYardsPerGame",
  yardsPerRushAttempt: "yardsPerRush",
  thirdDownConversionPct: "thirdDownPct",
  thirdDownConversions: "thirdDownPct",
  sacks: "sacks",
  turnovers: "giveaways",
  turnoverMargin: "turnoverDifferential",
  rushingTDs: "rushingTouchdowns",
  passingTDs: "passingTouchdowns",
  games: "gamesPlayed",
};

export function parseCfbdSeasonRows(payload: unknown): Partial<TeamSeasonStats> {
  const partial: Partial<TeamSeasonStats> = {};
  for (const row of asArray(payload)) {
    const rec = asRecord(row);
    if (!rec) continue;
    const name = str(rec.statName || rec.name);
    const key = STAT_MAP[name];
    if (!key) continue;
    const value = num(rec.statValue ?? rec.value);
    if (value == null || partial[key] != null) continue;
    (partial as Record<string, number | null>)[key] = value;
  }
  return partial;
}

export function mergeCfbdStats(
  espn: TeamSeasonStats,
  cfbd: Partial<TeamSeasonStats>
): { stats: TeamSeasonStats; filled: string[] } {
  const next = { ...espn };
  const filled: string[] = [];
  for (const [key, value] of Object.entries(cfbd) as Array<[keyof TeamSeasonStats, number | null | boolean]>) {
    if (key === "available") continue;
    if (typeof value !== "number") continue;
    if (next[key] != null) continue;
    (next as Record<string, number | boolean | null>)[key] = value;
    filled.push(String(key));
  }
  next.available = next.available || filled.length > 0;
  return { stats: next, filled };
}

export function cfbdCoverage(configured: boolean, filled: number): CoverageNote {
  if (!configured) {
    return {
      headline: "CFBD KEY NOT SET",
      detail:
        "CollegeFootballData is optional. Set CFBD_API_KEY for a free public key. Without it, Deep Dive uses ESPN only — no invented CFBD numbers.",
    };
  }
  if (filled > 0) {
    return {
      headline: "CFBD season stats merged",
      detail: `CollegeFootballData filled ${filled} blank ESPN cells. ESPN values are never overwritten.`,
    };
  }
  return {
    headline: "CFBD RETURNED NO MATCH",
    detail:
      "A CFBD key is configured, but this school did not match a season-stat row. ESPN cells stay as published or blank.",
  };
}

export async function fetchCfbdSeasonStats(
  teamName: string,
  year: number,
  apiKey: string
): Promise<Partial<TeamSeasonStats>> {
  const query = new URLSearchParams({
    year: String(year),
    team: teamName,
    seasonType: "regular",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${CFBD_BASE}/stats/season?${query.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "HarmonLine/1.0 (college football; +https://localhost)",
      },
      cache: "no-store",
    });
    if (!response.ok) return {};
    return parseCfbdSeasonRows(await response.json());
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

export function cfbdTeamQueryName(name: string, shortName: string): string {
  const school = name.replace(/\s+(Crimson Tide|Longhorns|Buckeyes|Tigers|Bulldogs|Wildcats|Eagles|Hawkeyes|Seminoles|Fighting Irish|Nittany Lions|Wolverines|Sooners|Ducks|Trojans|Bruins|Aggies|Jayhawks|Cyclones|Cowboys|Razorbacks|Volunteers|Commodores|Gators|Gamecocks|Tar Heels|Blue Devils|Hokies|Cavaliers|Orange|Orange)$/i, "");
  return (shortName || school || name).trim();
}
