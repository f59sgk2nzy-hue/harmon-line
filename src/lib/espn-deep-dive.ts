import {
  cfbdCoverage,
  cfbdKeyConfigured,
  cfbdTeamQueryName,
  fetchCfbdSeasonStats,
  mergeCfbdStats,
} from "@/lib/cfbd";
import { espnGet } from "@/lib/espn-http";
import { getGameDetail } from "@/lib/espn";
import {
  marketCoverage,
  oddsCoverage,
  oddsKeyConfigured,
  parsePublishedMarket,
  parseTeamSeasonStats,
  playerCoverage,
  scoringFromSchedule,
  statsCoverage,
} from "@/lib/espn-stats";
import { parseScheduleEvents } from "@/lib/espn-team";
import {
  BETTING_DISCLAIMER,
  BETTING_DISCLAIMER_LONG,
  MODEL_VERSION,
  buildMatchupAnalysis,
  buildPropAngles,
  rateTeam,
  runGameSimulation,
} from "@/lib/sim";
import type { DeepDiveResponse, GameSummary, LeaderLine, TeamScheduleGame, TeamSeasonStats } from "@/lib/types";

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
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
  homeCfbd?: Partial<TeamSeasonStats>;
  awayCfbd?: Partial<TeamSeasonStats>;
  cfbdConfigured?: boolean;
  oddsConfigured?: boolean;
  now?: Date;
}): DeepDiveResponse {
  const homeEspn = parseTeamSeasonStats(input.homeStatsRaw);
  const awayEspn = parseTeamSeasonStats(input.awayStatsRaw);
  const homeMerged = mergeCfbdStats(homeEspn, input.homeCfbd ?? {});
  const awayMerged = mergeCfbdStats(awayEspn, input.awayCfbd ?? {});
  const homeStats = homeMerged.stats;
  const awayStats = awayMerged.stats;
  const market = parsePublishedMarket(input.marketRaw);
  const home = rateTeam({
    stats: homeStats,
    scheduleScoring: scoringFromSchedule(input.homeSchedule),
    rank: input.game.home.rank,
    record: input.game.home.record,
    cfbdFilled: homeMerged.filled,
  });
  const away = rateTeam({
    stats: awayStats,
    scheduleScoring: scoringFromSchedule(input.awaySchedule),
    rank: input.game.away.rank,
    record: input.game.away.record,
    cfbdFilled: awayMerged.filled,
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
  const generatedAt = (input.now ?? new Date()).toISOString();
  const props = buildPropAngles({
    home,
    away,
    homeName: input.game.home.shortName,
    awayName: input.game.away.shortName,
    sim: simulation,
    market,
    leaders: input.leaders,
    gameId: input.game.id,
    gameName: input.game.shortName,
    dataAsOf: generatedAt,
  });
  const espnPublished = homeEspn.available || awayEspn.available;
  const filledCount = homeMerged.filled.length + awayMerged.filled.length;
  const eitherStats = homeStats.available || awayStats.available;
  const subdivision = input.game.subdivision;
  const evidence = [
    homeEspn.pointsPerGame != null
      ? `${input.game.home.shortName} ESPN PPG ${homeEspn.pointsPerGame}`
      : `${input.game.home.shortName} ESPN PPG not published`,
    awayEspn.pointsPerGame != null
      ? `${input.game.away.shortName} ESPN PPG ${awayEspn.pointsPerGame}`
      : `${input.game.away.shortName} ESPN PPG not published`,
    market
      ? `ESPN pickcenter: ${market.details ?? "line"} · O/U ${market.overUnder ?? "—"}`
      : "No ESPN pickcenter line on this summary",
    homeMerged.filled.length || awayMerged.filled.length
      ? `CFBD filled ${homeMerged.filled.length + awayMerged.filled.length} blank ESPN cells (${[
          ...homeMerged.filled.map((field) => `${input.game.home.shortName} ${field}`),
          ...awayMerged.filled.map((field) => `${input.game.away.shortName} ${field}`),
        ].join(", ")})`
      : "CFBD did not replace any ESPN cell",
  ];
  const inference = [
    `Projected ${simulation.expectedAwayScore}–${simulation.expectedHomeScore} (away–home)`,
    `Win probabilities ${Math.round(simulation.awayWinPct * 100)}% / ${Math.round(simulation.homeWinPct * 100)}% over ${simulation.trials} trials`,
    `Margin band ${simulation.marginLow} to ${simulation.marginHigh} · total ${simulation.totalLow}–${simulation.totalHigh}`,
    `Model confidence ${simulation.confidence} from data completeness (${MODEL_VERSION})`,
  ];

  return {
    source: "espn",
    demo: false,
    generatedAt,
    modelVersion: MODEL_VERSION,
    game: input.game,
    homeStats,
    awayStats,
    market,
    simulation,
    analysis,
    props,
    evidence,
    inference,
    coverage: {
      stats: eitherStats
        ? {
            headline: filledCount
              ? espnPublished
                ? "Season stats from ESPN; CFBD filled blank cells"
                : "Season stats from CFBD (ESPN sheet empty)"
              : "Season stats from ESPN public team statistics",
            detail: filledCount
              ? "ESPN published cells are never overwritten. CFBD only fills blanks when CFBD_API_KEY is set."
              : "Each side is filled only when ESPN published /teams/{id}/statistics. Blank cells are omissions, not zeros we invented.",
          }
        : statsCoverage(homeStats.available ? homeStats : awayStats, subdivision),
      market: marketCoverage(market),
      players: playerCoverage(input.leaders.filter((row) => row.name && row.displayValue).length),
      cfbd: cfbdCoverage(
        Boolean(input.cfbdConfigured),
        homeMerged.filled.length + awayMerged.filled.length
      ),
      odds: oddsCoverage(Boolean(input.oddsConfigured)),
    },
    disclaimer: BETTING_DISCLAIMER,
    disclaimerLong: BETTING_DISCLAIMER_LONG,
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

  const year = new Date(detail.game.date || Date.now()).getUTCFullYear();
  const key = process.env.CFBD_API_KEY?.trim() ?? "";
  const configured = cfbdKeyConfigured();
  let homeCfbd = {};
  let awayCfbd = {};
  if (key) {
    const [homeCfbdSettled, awayCfbdSettled] = await Promise.allSettled([
      fetchCfbdSeasonStats(
        cfbdTeamQueryName(detail.game.home.name, detail.game.home.shortName),
        year,
        key
      ),
      fetchCfbdSeasonStats(
        cfbdTeamQueryName(detail.game.away.name, detail.game.away.shortName),
        year,
        key
      ),
    ]);
    if (homeCfbdSettled.status === "fulfilled") homeCfbd = homeCfbdSettled.value;
    if (awayCfbdSettled.status === "fulfilled") awayCfbd = awayCfbdSettled.value;
  }

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
    homeCfbd,
    awayCfbd,
    cfbdConfigured: configured,
    oddsConfigured: oddsKeyConfigured(),
  });
}
