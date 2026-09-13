import type {
  GameSimulation,
  HarmonLinePropCard,
  LeaderLine,
  MatchupAnalysis,
  PropConfidence,
  PublishedMarket,
  ScheduleScoring,
  SimHistogramBin,
  TeamSeasonStats,
} from "@/lib/types";

export const MODEL_VERSION = "harmon-line-sim-v0";

export const BETTING_DISCLAIMER =
  "Entertainment and analysis only. Not financial, betting, or investment advice. 21+ only. Follow local laws. The Harmon Line does not take wagers and never treats a simulation as a lock.";

export const BETTING_DISCLAIMER_LONG = `${BETTING_DISCLAIMER} Simulations are model draws, not guaranteed results, live scores, or closing numbers. If you or someone you know has a gambling problem, call 1-800-GAMBLER. Must be 21+ and comply with local laws.`;

export const COLLEGE_PRIOR_PPG = 26.5;
export const TRIALS = 8000;
const HFA = 2.5;

export type TeamRating = {
  pointsFor: number;
  pointsAgainst: number;
  compositeOff: number;
  compositeDef: number;
  rank: number | null;
  record: string | null;
  usedPrior: boolean;
  sources: string[];
  gamesPlayed: number;
  stats: TeamSeasonStats;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function rankBoost(rank: number | null): number {
  if (rank == null || rank < 1 || rank > 25) return 0;
  return (13 - rank) * 0.35;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function rateTeam(input: {
  stats: TeamSeasonStats;
  scheduleScoring: ScheduleScoring;
  rank: number | null;
  record: string | null;
  cfbdFilled?: string[];
}): TeamRating {
  const cfbd = new Set(input.cfbdFilled ?? []);
  const sources: string[] = [];
  let pointsFor = input.stats.pointsPerGame;
  let pointsAgainst = input.stats.pointsAllowedPerGame;
  if (pointsFor != null) {
    sources.push(cfbd.has("pointsPerGame") ? "cfbd-season-stats" : "espn-team-statistics");
  }
  if (pointsFor == null && input.scheduleScoring.pointsPerGame != null) {
    pointsFor = input.scheduleScoring.pointsPerGame;
    sources.push("espn-schedule-scores");
  }
  if (pointsAgainst == null && input.scheduleScoring.pointsAllowedPerGame != null) {
    pointsAgainst = input.scheduleScoring.pointsAllowedPerGame;
    if (!sources.includes("espn-schedule-scores") && input.stats.pointsPerGame == null) {
      sources.push("espn-schedule-scores");
    }
  }
  if (pointsAgainst != null && input.stats.pointsAllowedPerGame != null) {
    const tag = cfbd.has("pointsAllowedPerGame") ? "cfbd-season-stats" : "espn-team-statistics";
    if (!sources.includes(tag)) sources.push(tag);
  }
  if (cfbd.size > 0 && !sources.includes("cfbd-season-stats")) {
    sources.push("cfbd-season-stats");
  }
  const usedPrior = pointsFor == null || pointsAgainst == null;
  if (usedPrior) sources.push("college-prior");
  const gamesPlayed =
    input.stats.gamesPlayed ??
    (input.scheduleScoring.games > 0 ? input.scheduleScoring.games : 0);
  const pointsForValue = pointsFor ?? COLLEGE_PRIOR_PPG;
  const pointsAgainstValue = pointsAgainst ?? COLLEGE_PRIOR_PPG;

  return {
    pointsFor: pointsForValue,
    pointsAgainst: pointsAgainstValue,
    compositeOff: compositeOffense(input.stats, pointsForValue),
    compositeDef: compositeDefense(input.stats, pointsAgainstValue),
    rank: input.rank,
    record: input.record,
    usedPrior,
    sources: [...new Set(sources)],
    gamesPlayed,
    stats: input.stats,
  };
}

export function compositeOffense(stats: TeamSeasonStats, ppg: number): number {
  const yards =
    (stats.rushingYardsPerGame ?? 0) + (stats.passingYardsPerGame ?? 0);
  const hasYards = stats.rushingYardsPerGame != null || stats.passingYardsPerGame != null;
  const yardTerm = hasYards ? yards / 15 : ppg;
  const thirdTerm = stats.thirdDownPct != null ? stats.thirdDownPct / 2 : ppg * 0.7;
  return 0.55 * ppg + 0.3 * yardTerm + 0.15 * thirdTerm;
}

export function compositeDefense(stats: TeamSeasonStats, papg: number): number {
  const yards =
    (stats.rushingYardsAllowedPerGame ?? 0) + (stats.passingYardsAllowedPerGame ?? 0);
  const hasYards =
    stats.rushingYardsAllowedPerGame != null || stats.passingYardsAllowedPerGame != null;
  const yardTerm = hasYards ? yards / 15 : papg;
  return 0.7 * papg + 0.3 * yardTerm;
}

export function simConfidenceFromData(home: TeamRating, away: TeamRating): PropConfidence {
  const complete = !home.usedPrior && !away.usedPrior;
  const games = Math.min(home.gamesPlayed, away.gamesPlayed);
  const rich =
    home.stats.available &&
    away.stats.available &&
    home.stats.rushingYardsPerGame != null &&
    away.stats.rushingYardsPerGame != null;
  if (complete && rich && games >= 4) return "HIGH";
  if (complete && games >= 2) return "MEDIUM";
  return "LOW";
}

function histogram(margins: number[], trials: number): SimHistogramBin[] {
  const edges = [-42, -35, -28, -21, -14, -7, 0, 7, 14, 21, 28, 35, 42];
  const bins: SimHistogramBin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const start = edges[i]!;
    const end = edges[i + 1]!;
    const count = margins.filter((value) => value >= start && value < end).length;
    bins.push({ start, end, count, pct: count / trials });
  }
  const first = edges[0]!;
  const last = edges[edges.length - 1]!;
  const under = margins.filter((value) => value < first).length;
  const over = margins.filter((value) => value >= last).length;
  if (under > 0) {
    bins.unshift({ start: first - 7, end: first, count: under, pct: under / trials });
  }
  if (over > 0) {
    bins.push({ start: last, end: last + 7, count: over, pct: over / trials });
  }
  return bins;
}

export function runGameSimulation(input: {
  home: TeamRating;
  away: TeamRating;
  homeField: boolean;
  seed?: number;
}): GameSimulation {
  const seed = input.seed ?? 2026;
  const rng = mulberry32(seed);
  const hfa = input.homeField ? HFA : 0;
  const expectedHomeScore = clamp(
    (input.home.compositeOff + input.away.compositeDef) / 2 +
      hfa / 2 +
      rankBoost(input.home.rank),
    3,
    72
  );
  const expectedAwayScore = clamp(
    (input.away.compositeOff + input.home.compositeDef) / 2 -
      hfa / 2 +
      rankBoost(input.away.rank),
    3,
    72
  );
  const sampleGames = Math.min(input.home.gamesPlayed, input.away.gamesPlayed);
  const bothPrior = input.home.usedPrior && input.away.usedPrior;
  const sigmaMargin = bothPrior ? 18 : sampleGames < 3 ? 16.5 : 14;
  const sigmaTotal = sigmaMargin * 0.85;
  const muMargin = expectedHomeScore - expectedAwayScore;
  const muTotal = expectedHomeScore + expectedAwayScore;

  const margins: number[] = [];
  const totals: number[] = [];
  let homeWins = 0;
  let awayWins = 0;
  let ties = 0;

  for (let i = 0; i < TRIALS; i += 1) {
    const margin = muMargin + sigmaMargin * normal(rng);
    const total = Math.max(6, muTotal + sigmaTotal * normal(rng));
    const homeScore = (total + margin) / 2;
    const awayScore = (total - margin) / 2;
    margins.push(margin);
    totals.push(total);
    if (homeScore > awayScore) homeWins += 1;
    else if (awayScore > homeScore) awayWins += 1;
    else ties += 1;
  }

  const sortedMargin = [...margins].sort((a, b) => a - b);
  const sortedTotal = [...totals].sort((a, b) => a - b);
  const inputsMissing: string[] = [];
  if (input.home.usedPrior) inputsMissing.push("home published scoring rate");
  if (input.away.usedPrior) inputsMissing.push("away published scoring rate");
  if (input.home.rank == null) inputsMissing.push("home AP rank");
  if (input.away.rank == null) inputsMissing.push("away AP rank");

  return {
    label: "SIMULATION",
    trials: TRIALS,
    seed,
    homeWinPct: pct(homeWins / TRIALS),
    awayWinPct: pct(awayWins / TRIALS),
    tiePct: pct(ties / TRIALS),
    meanMargin: round1(margins.reduce((sum, value) => sum + value, 0) / TRIALS),
    marginLow: round1(percentile(sortedMargin, 0.1)),
    marginHigh: round1(percentile(sortedMargin, 0.9)),
    meanTotal: round1(totals.reduce((sum, value) => sum + value, 0) / TRIALS),
    totalLow: round1(percentile(sortedTotal, 0.1)),
    totalHigh: round1(percentile(sortedTotal, 0.9)),
    sigmaMargin,
    expectedHomeScore: round1(expectedHomeScore),
    expectedAwayScore: round1(expectedAwayScore),
    confidence: simConfidenceFromData(input.home, input.away),
    histogram: histogram(margins, TRIALS),
    assumptions: [
      "Composite efficiency: offense = 0.55·PPG + 0.30·(Y/G÷15) + 0.15·(3rd-down%÷2); defense = 0.70·PAPG + 0.30·(yards allowed÷15). Missing yard/3rd-down terms fall back to points.",
      "Expected score = (own composite offense + opponent composite defense) / 2.",
      `Home-field edge is ${HFA} points when a home side is marked, split across both expected scores.`,
      "AP rank (1–25) adjusts expected points by 0.35 per spot from rank 13. Unranked is 0.",
      `Monte Carlo: ${TRIALS} draws from independent normals for margin (σ=${sigmaMargin}) and total.`,
      "Output is a distribution (win probability + 10th–90th percentile bands), never a single lock.",
    ],
    inputsUsed: [...input.home.sources, ...input.away.sources].filter(
      (value, index, all) => all.indexOf(value) === index
    ),
    inputsMissing,
  };
}

function confidenceFrom(sample: number, edge: number): PropConfidence {
  if (sample >= 4 && edge >= 0.2) return "HIGH";
  if (sample >= 2 && edge >= 0.1) return "MEDIUM";
  return "LOW";
}

function marketOdds(
  market: PublishedMarket | null,
  line?: string | null
): HarmonLinePropCard["oddsAvailable"] {
  if (!market) return null;
  const text = line || market.details || (market.overUnder != null ? `O/U ${market.overUnder}` : null);
  if (!text) return null;
  return { line: text, provider: market.provider };
}

function cardBase(input: {
  gameId: string;
  gameName: string;
  dataAsOf: string;
}): Pick<HarmonLinePropCard, "game" | "edge_vs_market" | "disclaimers" | "data_as_of" | "model_version"> {
  return {
    game: { id: input.gameId, name: input.gameName },
    edge_vs_market: null,
    disclaimers: [
      "Entertainment / analysis only. Not financial advice.",
      "Simulation shares are not guaranteed results.",
      "21+ · 1-800-GAMBLER · follow local laws.",
    ],
    data_as_of: input.dataAsOf,
    model_version: MODEL_VERSION,
  };
}

export function buildPropAngles(input: {
  home: TeamRating;
  away: TeamRating;
  homeName: string;
  awayName: string;
  sim: GameSimulation;
  market: PublishedMarket | null;
  leaders: LeaderLine[];
  gameId?: string;
  gameName?: string;
  dataAsOf?: string;
}): HarmonLinePropCard[] {
  const sample = Math.min(input.home.gamesPlayed, input.away.gamesPlayed);
  const cards: HarmonLinePropCard[] = [];
  const favoriteHome = input.sim.homeWinPct >= input.sim.awayWinPct;
  const favoritePct = favoriteHome ? input.sim.homeWinPct : input.sim.awayWinPct;
  const favoriteName = favoriteHome ? input.homeName : input.awayName;
  const sideEdge = Math.abs(input.sim.homeWinPct - 0.5);
  const shared = cardBase({
    gameId: input.gameId ?? "game",
    gameName: input.gameName ?? `${input.awayName} at ${input.homeName}`,
    dataAsOf: input.dataAsOf ?? new Date().toISOString(),
  });

  cards.push({
    ...shared,
    id: "ml",
    market: "ML",
    title: "Moneyline lean",
    lean: `${favoriteName} to win (${Math.round(favoritePct * 100)}% of sims)`,
    confidence: input.home.usedPrior || input.away.usedPrior ? "LOW" : confidenceFrom(sample, sideEdge),
    why: `SIMULATION expected score ${input.sim.expectedAwayScore}–${input.sim.expectedHomeScore} (away–home). ${Math.round(input.sim.homeWinPct * 100)}% home / ${Math.round(input.sim.awayWinPct * 100)}% away across ${input.sim.trials} trials. This is a lean, not a lock.`,
    fair_line: null,
    fair_prob: favoritePct,
    evidence: [
      `${input.homeName} ${round1(input.home.pointsFor)} PPG / ${round1(input.home.pointsAgainst)} allowed (${input.home.sources.join(", ")})`,
      `${input.awayName} ${round1(input.away.pointsFor)} PPG / ${round1(input.away.pointsAgainst)} allowed (${input.away.sources.join(", ")})`,
      input.market?.details ? `ESPN pickcenter published ${input.market.details}` : "No dedicated odds API line in v0",
    ],
    inference: [
      `Model win probability ${Math.round(favoritePct * 100)}% for ${favoriteName}`,
      `Projected ${input.sim.expectedAwayScore}–${input.sim.expectedHomeScore} (away–home)`,
    ],
    basis: "simulation",
    playerName: null,
    oddsAvailable: marketOdds(input.market, input.market?.details),
  });

  const fairSpread = round1(-input.sim.meanMargin);
  cards.push({
    ...shared,
    id: "spread",
    market: "spread",
    title: "Spread lean",
    lean: `${input.homeName} ${fairSpread > 0 ? "+" : ""}${fairSpread} fair (home)`,
    confidence: input.sim.confidence,
    why: `Fair home spread is the model mean margin flipped to a line (${fairSpread}). 10th–90th home margin ${input.sim.marginLow} to ${input.sim.marginHigh}. Not a lock.`,
    fair_line: fairSpread,
    fair_prob: input.sim.homeWinPct,
    evidence: [
      input.market?.details ? `Published ESPN market: ${input.market.details}` : "No published spread on this feed",
      `Composite off/def used for both sides (see model assumptions)`,
    ],
    inference: [
      `Mean home margin ${input.sim.meanMargin} from ${input.sim.trials} draws`,
      `Percentile band ${input.sim.marginLow} to ${input.sim.marginHigh}`,
    ],
    basis: "simulation",
    playerName: null,
    oddsAvailable: marketOdds(input.market, input.market?.details),
  });

  const marketTotal = input.market?.overUnder ?? null;
  const modelTotal = input.sim.meanTotal;
  const totalLean =
    marketTotal == null
      ? `Model total ${modelTotal} (no published market)`
      : modelTotal > marketTotal
        ? `Over ${marketTotal} (model ${modelTotal})`
        : `Under ${marketTotal} (model ${modelTotal})`;
  const totalEdge =
    marketTotal == null ? Math.min(0.18, Math.abs(modelTotal - 52) / 40) : Math.abs(modelTotal - marketTotal) / 28;

  cards.push({
    ...shared,
    id: "total",
    market: "total",
    title: "Game total",
    lean: totalLean,
    confidence:
      input.home.usedPrior || input.away.usedPrior
        ? "LOW"
        : confidenceFrom(sample, marketTotal == null ? totalEdge : Math.min(1, Math.abs(modelTotal - marketTotal) / 20)),
    why:
      marketTotal == null
        ? `Combined expected points ${modelTotal} (10th–90th ${input.sim.totalLow}–${input.sim.totalHigh}). No dedicated odds API — edge_vs_market stays null.`
        : `ESPN published O/U ${marketTotal} (${input.market?.provider}). Model mean total ${modelTotal}. Paid-odds edge is not computed in v0.`,
    fair_line: modelTotal,
    fair_prob: null,
    evidence: [
      marketTotal != null
        ? `ESPN pickcenter O/U ${marketTotal} (${input.market?.provider})`
        : "ESPN pickcenter did not publish an over/under",
    ],
    inference: [
      `Model mean total ${modelTotal}`,
      `Percentile band ${input.sim.totalLow}–${input.sim.totalHigh}`,
    ],
    basis: marketTotal == null ? "simulation" : "published-market",
    playerName: null,
    oddsAvailable: marketOdds(
      input.market,
      marketTotal != null ? `O/U ${marketTotal}` : null
    ),
  });

  for (const leader of input.leaders) {
    const name = leader.name.trim();
    if (!name) continue;
    const display = leader.displayValue.trim();
    if (!display) continue;
    cards.push({
      ...shared,
      id: `player-${leader.category}-${name}`,
      market: "player_prop",
      title: `${leader.category} · published`,
      lean: `${name} volume watch`,
      confidence: "LOW",
      why: `ESPN published ${name} at ${display} (${leader.category}). That is the last listed line — not a projected stat line we created. Use it as a research pointer only.`,
      fair_line: null,
      fair_prob: null,
      evidence: [`ESPN leader ${name}: ${display} (${leader.category})`],
      inference: ["No player-level projection is invented beyond the published line."],
      basis: "published-leaders",
      playerName: name,
      oddsAvailable: null,
    });
  }

  return cards.slice(0, 8);
}

function rushTdRate(team: TeamRating): number | null {
  if (team.stats.rushingTouchdowns == null) return null;
  const games = team.stats.gamesPlayed || team.gamesPlayed;
  if (!games) return team.stats.rushingTouchdowns;
  return team.stats.rushingTouchdowns / games;
}

export function buildMatchupAnalysis(input: {
  home: TeamRating;
  away: TeamRating;
  homeName: string;
  awayName: string;
}): MatchupAnalysis {
  const paragraphs: string[] = [];
  const homeScore = input.home.usedPrior
    ? `${input.homeName} has no published scoring rate on this ESPN feed, so the model uses the labeled college prior (${COLLEGE_PRIOR_PPG} PPG).`
    : `${input.homeName} is at ${round1(input.home.pointsFor)} points per game and ${round1(input.home.pointsAgainst)} allowed (${input.home.sources.join(", ")}).`;
  const awayScore = input.away.usedPrior
    ? `${input.awayName} has no published scoring rate — prior only, not a live score.`
    : `${input.awayName} is at ${round1(input.away.pointsFor)} points per game and ${round1(input.away.pointsAgainst)} allowed.`;
  paragraphs.push(homeScore);
  paragraphs.push(awayScore);

  const homeEff = describeEfficiency(input.homeName, input.home.stats);
  const awayEff = describeEfficiency(input.awayName, input.away.stats);
  if (homeEff) paragraphs.push(homeEff);
  if (awayEff) paragraphs.push(awayEff);

  if (input.home.rank || input.away.rank || input.home.record || input.away.record) {
    paragraphs.push(
      [
        input.home.rank ? `${input.homeName} ranked No. ${input.home.rank}` : null,
        input.home.record ? `(${input.home.record})` : null,
        input.away.rank ? `· ${input.awayName} ranked No. ${input.away.rank}` : null,
        input.away.record ? `(${input.away.record})` : null,
      ]
        .filter(Boolean)
        .join(" ") + "."
    );
  }

  paragraphs.push(
    "This write-up is ANALYSIS from public ESPN numbers plus a transparent rating. It is not a lock, a betting ticket, or a live score."
  );

  return {
    markedAs: "ANALYSIS",
    headline: `INFERENCE · ANALYSIS · ${input.awayName} at ${input.homeName}`,
    paragraphs,
  };
}

function describeEfficiency(name: string, stats: TeamSeasonStats): string | null {
  const bits: string[] = [];
  if (stats.rushingYardsPerGame != null) bits.push(`${stats.rushingYardsPerGame} rush Y/G`);
  if (stats.passingYardsPerGame != null) bits.push(`${stats.passingYardsPerGame} pass Y/G`);
  if (stats.thirdDownPct != null) bits.push(`${stats.thirdDownPct}% on third down`);
  if (stats.turnoverDifferential != null) bits.push(`TO diff ${stats.turnoverDifferential}`);
  if (bits.length === 0) return null;
  return `${name} published efficiency: ${bits.join(" · ")}.`;
}

export function formatWinPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
