import { getGameDetail } from "@/lib/espn";
import {
  marketCoverage,
  parsePublishedMarket,
  parseTeamSeasonStats,
  playerCoverage,
  scoringFromSchedule,
  statsCoverage,
} from "@/lib/espn-stats";
import { parseScheduleEvents } from "@/lib/espn-team";
import { BETTING_DISCLAIMER, buildMatchupAnalysis, buildPropAngles, rateTeam, runGameSimulation } from "@/lib/sim";
import type { DeepDiveResponse, GameSummary, LeaderLine, TeamScheduleGame } from "@/lib/types";

const ESPN_WEB =
  process.env.ESPN_WEB_BASE ??
  "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_SITE =
  process.env.ESPN_SITE_BASE ??
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

const FETCH_TIMEOUT_MS = 12_000;

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

async function espnGet(path: string): Promise<Json> {
  const bases = [ESPN_WEB, ESPN_SITE];
  let lastError: Error | null = null;
  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}${path}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "HarmonLine/1.0 (college football scoreboard; +https://localhost)",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`ESPN ${response.status} from ${base}`);
        continue;
      }
      const data = asRecord(await response.json());
      if (!data) {
        lastError = new Error("ESPN returned a non-object payload");
        continue;
      }
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("Unable to reach ESPN public APIs");
}

async function settledJson(path: string): Promise<unknown> {
  try {
    return await espnGet(path);
  } catch {
    return {};
  }
}

export function assembleDeepDive(input: {
  game: GameSummary;
  leaders: LeaderLine[];
  homeStatsRaw: unknown;
  awayStatsRaw: unknown;
  homeSchedule: TeamScheduleGame[];
  awaySchedule: TeamScheduleGame[];
  marketRaw: unknown;
  now?: Date;
}): DeepDiveResponse {
  const homeStats = parseTeamSeasonStats(input.homeStatsRaw);
  const awayStats = parseTeamSeasonStats(input.awayStatsRaw);
  const market = parsePublishedMarket(input.marketRaw);
  const home = rateTeam({
    stats: homeStats,
    scheduleScoring: scoringFromSchedule(input.homeSchedule),
    rank: input.game.home.rank,
    record: input.game.home.record,
  });
  const away = rateTeam({
    stats: awayStats,
    scheduleScoring: scoringFromSchedule(input.awaySchedule),
    rank: input.game.away.rank,
    record: input.game.away.record,
  });
  const seed = Number.parseInt(input.game.id.replace(/\D/g, "").slice(-8) || "2026", 10);
  const simulation = runGameSimulation({
    home,
    away,
    homeField: Boolean(input.game.home.id),
    seed: Number.isFinite(seed) ? seed : 2026,
  });
  const analysis = buildMatchupAnalysis({
    home,
    away,
    homeName: input.game.home.shortName,
    awayName: input.game.away.shortName,
  });
  const props = buildPropAngles({
    home,
    away,
    homeName: input.game.home.shortName,
    awayName: input.game.away.shortName,
    sim: simulation,
    market,
    leaders: input.leaders,
  });
  const eitherStats = homeStats.available || awayStats.available;
  const subdivision = input.game.subdivision;

  return {
    source: "espn",
    demo: false,
    generatedAt: (input.now ?? new Date()).toISOString(),
    game: input.game,
    homeStats,
    awayStats,
    market,
    simulation,
    analysis,
    props,
    coverage: {
      stats: eitherStats
        ? {
            headline: "Season stats from ESPN public team statistics",
            detail:
              "Each side is filled only when ESPN published /teams/{id}/statistics. Blank cells are omissions, not zeros we invented.",
          }
        : statsCoverage(homeStats.available ? homeStats : awayStats, subdivision),
      market: marketCoverage(market),
      players: playerCoverage(input.leaders.filter((row) => row.name && row.displayValue).length),
    },
    disclaimer: BETTING_DISCLAIMER,
  };
}

export async function getDeepDive(eventId: string): Promise<DeepDiveResponse> {
  if (!/^\d+$/.test(eventId)) {
    throw new Error("Invalid game id");
  }
  const detail = await getGameDetail(eventId);
  const homeId = detail.game.home.id;
  const awayId = detail.game.away.id;
  const [homeStatsRaw, awayStatsRaw, homeScheduleRaw, awayScheduleRaw, summaryRaw] =
    await Promise.all([
      settledJson(`/teams/${homeId}/statistics`),
      settledJson(`/teams/${awayId}/statistics`),
      settledJson(`/teams/${homeId}/schedule`),
      settledJson(`/teams/${awayId}/schedule`),
      settledJson(`/summary?event=${eventId}`),
    ]);

  const homeEvents = asRecord(homeScheduleRaw)?.events;
  const awayEvents = asRecord(awayScheduleRaw)?.events;

  return assembleDeepDive({
    game: detail.game,
    leaders: detail.leaders,
    homeStatsRaw,
    awayStatsRaw,
    homeSchedule: parseScheduleEvents(homeEvents, homeId),
    awaySchedule: parseScheduleEvents(awayEvents, awayId),
    marketRaw: summaryRaw,
  });
}
