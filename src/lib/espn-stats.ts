import type {
  Classification,
  CoverageNote,
  PublishedMarket,
  ScheduleScoring,
  TeamScheduleGame,
  TeamSeasonStats,
} from "@/lib/types";

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

function categoriesFrom(node: unknown): unknown[] {
  if (Array.isArray(node)) return node;
  const rec = asRecord(node);
  if (!rec) return [];
  if (Array.isArray(rec.categories)) return rec.categories;
  if (Array.isArray(rec.stats)) return [rec];
  return [];
}

function firstStat(
  categories: unknown[],
  names: string[],
  categoryNames?: string[]
): number | null {
  const wanted = new Set(names);
  const cats = categoryNames ? new Set(categoryNames) : null;
  for (const category of categories) {
    const rec = asRecord(category);
    if (cats && rec && !cats.has(str(rec.name))) continue;
    for (const row of asArray(rec?.stats)) {
      const stat = asRecord(row);
      if (!stat) continue;
      if (!wanted.has(str(stat.name))) continue;
      const value = num(stat.value) ?? num(stat.displayValue);
      if (value != null) return value;
    }
  }
  return null;
}

export function emptyTeamSeasonStats(): TeamSeasonStats {
  return {
    available: false,
    gamesPlayed: null,
    pointsPerGame: null,
    pointsTotal: null,
    pointsAllowedPerGame: null,
    passingYardsPerGame: null,
    rushingYardsPerGame: null,
    yardsPerRush: null,
    yardsPerPass: null,
    completionPct: null,
    thirdDownPct: null,
    turnoverDifferential: null,
    giveaways: null,
    takeaways: null,
    rushingTouchdowns: null,
    passingTouchdowns: null,
    totalTouchdowns: null,
    interceptionsThrown: null,
    sacks: null,
    fieldGoalsMade: null,
    fieldGoalAttempts: null,
    rushingYardsAllowedPerGame: null,
    passingYardsAllowedPerGame: null,
  };
}

export function parseTeamSeasonStats(payload: unknown): TeamSeasonStats {
  const root = asRecord(payload) ?? {};
  const results = asRecord(root.results) ?? {};
  const own = categoriesFrom(results.stats ?? root.categories ?? root.stats);
  const opponent = categoriesFrom(results.opponent);
  const empty = emptyTeamSeasonStats();
  if (own.length === 0 && opponent.length === 0) return empty;

  const stats: TeamSeasonStats = {
    ...empty,
    gamesPlayed: firstStat(own, ["gamesPlayed", "teamGamesPlayed"]),
    pointsPerGame: firstStat(own, ["totalPointsPerGame"]),
    pointsTotal: firstStat(own, ["totalPoints"]),
    pointsAllowedPerGame: firstStat(opponent, ["totalPointsPerGame"]),
    passingYardsPerGame: firstStat(own, ["netPassingYardsPerGame", "passingYardsPerGame"]),
    rushingYardsPerGame: firstStat(own, ["rushingYardsPerGame"]),
    yardsPerRush: firstStat(own, ["yardsPerRushAttempt"]),
    yardsPerPass: firstStat(own, ["yardsPerPassAttempt"]),
    completionPct: firstStat(own, ["completionPct"]),
    thirdDownPct: firstStat(own, ["thirdDownConvPct"]),
    turnoverDifferential: firstStat(own, ["turnOverDifferential"]),
    giveaways: firstStat(own, ["totalGiveaways"]),
    takeaways: firstStat(own, ["totalTakeaways"]),
    rushingTouchdowns: firstStat(own, ["rushingTouchdowns"]),
    passingTouchdowns: firstStat(own, ["passingTouchdowns"]),
    totalTouchdowns: firstStat(own, ["totalTouchdowns"]),
    interceptionsThrown: firstStat(own, ["interceptions"], ["passing"]),
    sacks: firstStat(own, ["sacks"], ["defensive", "defensiveInterceptions"]),
    fieldGoalsMade: firstStat(own, ["fieldGoalsMade"]),
    fieldGoalAttempts: firstStat(own, ["fieldGoalAttempts"]),
    rushingYardsAllowedPerGame: firstStat(opponent, ["rushingYardsPerGame"]),
    passingYardsAllowedPerGame: firstStat(opponent, [
      "netPassingYardsPerGame",
      "passingYardsPerGame",
    ]),
  };

  stats.available = Object.entries(stats).some(
    ([key, value]) => key !== "available" && value != null
  );
  return stats;
}

export function parsePublishedMarket(payload: unknown): PublishedMarket | null {
  const root = asRecord(payload) ?? {};
  const rows = asArray(root.pickcenter);
  const first = asRecord(rows[0]);
  if (!first) return null;
  const provider = str(asRecord(first.provider)?.name, "ESPN pickcenter");
  const details = str(first.details) || null;
  const overUnder = num(first.overUnder);
  const spread = num(first.spread);
  const homeOdds = asRecord(first.homeTeamOdds);
  const awayOdds = asRecord(first.awayTeamOdds);
  const homeMoneyLine = num(homeOdds?.moneyLine);
  const awayMoneyLine = num(awayOdds?.moneyLine);
  if (!details && overUnder == null && spread == null && homeMoneyLine == null && awayMoneyLine == null) {
    return null;
  }
  return {
    provider,
    details,
    overUnder,
    spread,
    homeMoneyLine,
    awayMoneyLine,
  };
}

export function scoringFromSchedule(games: TeamScheduleGame[]): ScheduleScoring {
  const completed = games.filter(
    (game) => game.teamScore != null && game.opponentScore != null
  );
  if (completed.length === 0) {
    return { games: 0, pointsPerGame: null, pointsAllowedPerGame: null };
  }
  const pointsFor = completed.reduce((sum, game) => sum + (game.teamScore ?? 0), 0);
  const pointsAgainst = completed.reduce((sum, game) => sum + (game.opponentScore ?? 0), 0);
  return {
    games: completed.length,
    pointsPerGame: pointsFor / completed.length,
    pointsAllowedPerGame: pointsAgainst / completed.length,
  };
}

export function statsCoverage(
  stats: TeamSeasonStats,
  subdivision: Classification | null
): CoverageNote {
  if (stats.available) {
    return {
      headline: "Season stats from ESPN public team statistics",
      detail:
        "Rates come from ESPN’s unofficial /teams/{id}/statistics JSON. Missing cells stay blank.",
    };
  }
  if (subdivision === "NAIA") {
    return {
      headline: "STATS NOT ON THIS FEED",
      detail:
        "ESPN often omits NAIA season statistics. The sim uses a labeled college prior — no invented live scores.",
    };
  }
  if (subdivision === "D2" || subdivision === "D3") {
    return {
      headline: "STATS NOT PUBLISHED",
      detail: `ESPN has no ${subdivision} season-stat sheet on the public team endpoint for this school.`,
    };
  }
  return {
    headline: "STATS NOT PUBLISHED",
    detail: "ESPN has not released a team statistics payload for this school.",
  };
}

export function marketCoverage(market: PublishedMarket | null): CoverageNote {
  if (market) {
    return {
      headline: `Published market · ${market.provider}`,
      detail:
        "Line is whatever ESPN’s public pickcenter included (often DraftKings). It is not a Harmon Line price and not a third-party odds API.",
    };
  }
  return {
    headline: "NO LIVE ODDS ON THIS FEED",
    detail:
      "ESPN pickcenter was empty. Prop cards still show model leans. A dedicated odds API (ODDS_API_KEY) is reserved for later — not used in v0.",
  };
}

export function playerCoverage(leaderCount: number): CoverageNote {
  if (leaderCount > 0) {
    return {
      headline: "Player notes from published ESPN leaders",
      detail:
        "Names and lines are copied from the game summary leaders list. Season player props are not invented.",
    };
  }
  return {
    headline: "NO PUBLISHED PLAYER LINES",
    detail:
      "ESPN did not include game leaders with stats. Team-level prop cards still appear. Player names are never fabricated.",
  };
}

export function deepDiveHref(gameId: string): string {
  return `/game/${encodeURIComponent(gameId)}/deep-dive`;
}

export function teamDeepDiveHref(teamId: string): string {
  return `/team/${encodeURIComponent(teamId)}/deep-dive`;
}

export function nextDeepDiveGameId(
  upcoming: Array<{ id: string }>,
  recent: Array<{ id: string }>
): string | null {
  return upcoming[0]?.id ?? recent[0]?.id ?? null;
}
