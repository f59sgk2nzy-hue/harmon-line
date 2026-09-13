import type {
  GameSimulation,
  LeaderLine,
  MatchupAnalysis,
  PropAngle,
  PropConfidence,
  PublishedMarket,
  ScheduleScoring,
  SimHistogramBin,
  TeamSeasonStats,
} from "@/lib/types";

export const BETTING_DISCLAIMER =
  "Entertainment and analysis only. Not financial, betting, or investment advice. 21+ only. Follow local laws. The Harmon Line does not take wagers and never treats a simulation as a lock.";

export const COLLEGE_PRIOR_PPG = 26.5;
const TRIALS = 4000;
const HFA = 2.5;

export type TeamRating = {
  pointsFor: number;
  pointsAgainst: number;
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
}): TeamRating {
  const sources: string[] = [];
  let pointsFor = input.stats.pointsPerGame;
  let pointsAgainst = input.stats.pointsAllowedPerGame;
  if (pointsFor != null) sources.push("espn-team-statistics");
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
  if (pointsAgainst != null && input.stats.pointsAllowedPerGame != null && !sources.includes("espn-team-statistics")) {
    sources.push("espn-team-statistics");
  }
  const usedPrior = pointsFor == null || pointsAgainst == null;
  if (usedPrior) sources.push("college-prior");
  const gamesPlayed =
    input.stats.gamesPlayed ??
    (input.scheduleScoring.games > 0 ? input.scheduleScoring.games : 0);

  return {
    pointsFor: pointsFor ?? COLLEGE_PRIOR_PPG,
    pointsAgainst: pointsAgainst ?? COLLEGE_PRIOR_PPG,
    rank: input.rank,
    record: input.record,
    usedPrior,
    sources: [...new Set(sources)],
    gamesPlayed,
    stats: input.stats,
  };
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
    (input.home.pointsFor + input.away.pointsAgainst) / 2 + hfa / 2 + rankBoost(input.home.rank),
    3,
    72
  );
  const expectedAwayScore = clamp(
    (input.away.pointsFor + input.home.pointsAgainst) / 2 - hfa / 2 + rankBoost(input.away.rank),
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
    histogram: histogram(margins, TRIALS),
    assumptions: [
      "Transparent rating: expected score = (own PPG + opponent points allowed) / 2.",
      `Home-field edge is ${HFA} points when a home side is marked, split across both expected scores.`,
      "AP rank (1–25) adjusts expected points by 0.35 per spot from rank 13. Unranked is 0.",
      `Monte Carlo: ${TRIALS} draws from independent normals for margin (σ=${sigmaMargin}) and total.`,
      "Output is a distribution (win probability + 10th–90th percentile margin), never a single lock.",
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
): PropAngle["oddsAvailable"] {
  if (!market) return null;
  const text = line || market.details || (market.overUnder != null ? `O/U ${market.overUnder}` : null);
  if (!text) return null;
  return { line: text, provider: market.provider };
}

export function buildPropAngles(input: {
  home: TeamRating;
  away: TeamRating;
  homeName: string;
  awayName: string;
  sim: GameSimulation;
  market: PublishedMarket | null;
  leaders: LeaderLine[];
}): PropAngle[] {
  const sample = Math.min(input.home.gamesPlayed, input.away.gamesPlayed);
  const cards: PropAngle[] = [];
  const favoriteHome = input.sim.homeWinPct >= input.sim.awayWinPct;
  const favoritePct = favoriteHome ? input.sim.homeWinPct : input.sim.awayWinPct;
  const favoriteName = favoriteHome ? input.homeName : input.awayName;
  const sideEdge = Math.abs(input.sim.homeWinPct - 0.5);

  cards.push({
    id: "side",
    market: "side",
    title: "Moneyline lean",
    lean: `${favoriteName} to win (${Math.round(favoritePct * 100)}% of sims)`,
    confidence: input.home.usedPrior || input.away.usedPrior ? "LOW" : confidenceFrom(sample, sideEdge),
    why: `SIMULATION expected score ${input.sim.expectedAwayScore}–${input.sim.expectedHomeScore} (away–home) from published or prior scoring rates. ${Math.round(input.sim.homeWinPct * 100)}% home / ${Math.round(input.sim.awayWinPct * 100)}% away across ${input.sim.trials} trials. This is a lean, not a lock.`,
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
    id: "total",
    market: "game-total",
    title: "Game total",
    lean: totalLean,
    confidence:
      input.home.usedPrior || input.away.usedPrior
        ? "LOW"
        : confidenceFrom(sample, marketTotal == null ? totalEdge : Math.min(1, Math.abs(modelTotal - marketTotal) / 20)),
    why:
      marketTotal == null
        ? `Combined expected points ${modelTotal} (10th–90th ${input.sim.totalLow}–${input.sim.totalHigh}). ESPN pickcenter did not publish an over/under, so this card is structured for a later odds feed.`
        : `ESPN published O/U ${marketTotal} (${input.market?.provider}). Model mean total ${modelTotal} sits ${round1(modelTotal - marketTotal)} points ${modelTotal >= marketTotal ? "over" : "under"} that number. Early-season samples stay conservative.`,
    basis: marketTotal == null ? "simulation" : "published-market",
    playerName: null,
    oddsAvailable: marketOdds(
      input.market,
      marketTotal != null ? `O/U ${marketTotal}` : null
    ),
  });

  const homeRush = rushTdRate(input.home);
  const awayRush = rushTdRate(input.away);
  if (homeRush != null || awayRush != null) {
    const homeRate = homeRush ?? 0;
    const awayRate = awayRush ?? 0;
    const rushLeader = homeRate >= awayRate ? input.homeName : input.awayName;
    const rushLead = Math.abs(homeRate - awayRate);
    if (rushLead >= 0.4) {
      cards.push({
        id: "rush-td",
        market: "team-rush-td",
        title: "Team rushing TDs",
        lean: `${rushLeader} rushing-TD volume`,
        confidence: confidenceFrom(sample, Math.min(1, rushLead / 3)),
        why: `${input.homeName} ${homeRush == null ? "has no published rush TDs" : `${round1(homeRate)} rush TD/g`} · ${input.awayName} ${awayRush == null ? "has no published rush TDs" : `${round1(awayRate)} rush TD/g`} on ESPN team statistics. Lean the higher published rate — not an invented player prop.`,
        basis: "team-stats",
        playerName: null,
        oddsAvailable: null,
      });
    }
  }

  for (const leader of input.leaders) {
    const name = leader.name.trim();
    if (!name) continue;
    const display = leader.displayValue.trim();
    if (!display) continue;
    cards.push({
      id: `player-${leader.category}-${name}`,
      market: "player-published",
      title: `${leader.category} · published`,
      lean: `${name} volume watch`,
      confidence: "LOW",
      why: `ESPN published ${name} at ${display} (${leader.category}). That is the last listed line — not a projected stat line we created. Use it as a research pointer only.`,
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
    headline: `ANALYSIS · ${input.awayName} at ${input.homeName}`,
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
