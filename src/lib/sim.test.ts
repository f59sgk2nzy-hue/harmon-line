import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTeamSeasonStats } from "./espn-stats";
import {
  BETTING_DISCLAIMER,
  BETTING_DISCLAIMER_LONG,
  TRIALS,
  buildMatchupAnalysis,
  buildPropAngles,
  compositeOffense,
  rateTeam,
  runGameSimulation,
} from "./sim";
import type { LeaderLine, TeamSeasonStats } from "./types";

function stats(partial: Partial<TeamSeasonStats>): TeamSeasonStats {
  return {
    ...emptyTeamSeasonStats(),
    available: true,
    gamesPlayed: 4,
    ...partial,
  };
}

describe("rateTeam", () => {
  it("uses published PPG and points allowed, not a hidden demo score", () => {
    const rated = rateTeam({
      stats: stats({ pointsPerGame: 40, pointsAllowedPerGame: 14 }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: 4,
      record: "4-0",
    });
    assert.equal(rated.pointsFor, 40);
    assert.equal(rated.pointsAgainst, 14);
    assert.ok(rated.sources.includes("espn-team-statistics"));
    assert.equal(rated.usedPrior, false);
  });

  it("falls back to schedule scoring when ESPN omitted season PPG", () => {
    const rated = rateTeam({
      stats: emptyTeamSeasonStats(),
      scheduleScoring: { games: 2, pointsPerGame: 31, pointsAllowedPerGame: 17 },
      rank: null,
      record: "2-0",
    });
    assert.equal(rated.pointsFor, 31);
    assert.equal(rated.pointsAgainst, 17);
    assert.ok(rated.sources.includes("espn-schedule-scores"));
    assert.equal(rated.usedPrior, false);
  });

  it("labels the college prior when no scoring rates exist — does not invent a live score", () => {
    const rated = rateTeam({
      stats: emptyTeamSeasonStats(),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: null,
    });
    assert.equal(rated.usedPrior, true);
    assert.ok(rated.sources.includes("college-prior"));
    assert.ok(rated.pointsFor > 0);
  });
});

describe("runGameSimulation", () => {
  it("gives the stronger home team a win probability, not a lock", () => {
    const sim = runGameSimulation({
      home: rateTeam({
        stats: stats({ pointsPerGame: 42, pointsAllowedPerGame: 12 }),
        scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
        rank: 3,
        record: "4-0",
      }),
      away: rateTeam({
        stats: stats({ pointsPerGame: 17, pointsAllowedPerGame: 31 }),
        scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
        rank: null,
        record: "1-3",
      }),
      homeField: true,
      seed: 13,
    });
    assert.equal(sim.label, "SIMULATION");
    assert.ok(sim.trials >= 5000 && sim.trials <= 10_000);
    assert.equal(sim.trials, TRIALS);
    assert.ok(sim.confidence === "HIGH" || sim.confidence === "MEDIUM" || sim.confidence === "LOW");
    assert.ok(sim.homeWinPct > 0.58);
    assert.ok(sim.homeWinPct < 0.995);
    assert.ok(sim.awayWinPct > 0.005);
    assert.ok(sim.marginLow < sim.meanMargin);
    assert.ok(sim.marginHigh > sim.meanMargin);
    assert.ok(sim.histogram.length > 4);
    assert.ok(sim.histogram.every((bin) => bin.count >= 0));
    const histTotal = sim.histogram.reduce((sum, bin) => sum + bin.count, 0);
    assert.equal(histTotal, sim.trials);
    assert.ok(sim.assumptions.some((line) => /Monte Carlo|normal/i.test(line)));
  });

  it("is deterministic for the same seed and widens sigma when both sides are priors", () => {
    const prior = rateTeam({
      stats: emptyTeamSeasonStats(),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: null,
    });
    const a = runGameSimulation({ home: prior, away: prior, homeField: true, seed: 7 });
    const b = runGameSimulation({ home: prior, away: prior, homeField: true, seed: 7 });
    assert.equal(a.homeWinPct, b.homeWinPct);
    assert.equal(a.meanMargin, b.meanMargin);
    assert.ok(a.sigmaMargin >= 16);
    assert.ok(a.homeWinPct > 0.45 && a.homeWinPct < 0.7);
    assert.ok(a.inputsMissing.length > 0);
  });
});

describe("buildPropAngles", () => {
  it("suggests team-level leans from stats and simulation, never as a lock", () => {
    const home = rateTeam({
      stats: stats({
        pointsPerGame: 40,
        pointsAllowedPerGame: 14,
        rushingTouchdowns: 12,
        gamesPlayed: 4,
      }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: 5,
      record: "4-0",
    });
    const away = rateTeam({
      stats: stats({
        pointsPerGame: 20,
        pointsAllowedPerGame: 28,
        rushingTouchdowns: 2,
        gamesPlayed: 4,
      }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: "1-3",
    });
    const sim = runGameSimulation({ home, away, homeField: true, seed: 21 });
    const props = buildPropAngles({
      home,
      away,
      homeName: "Alabama",
      awayName: "Vanderbilt",
      sim,
      market: { provider: "DraftKings", details: "ALA -17.5", overUnder: 52.5, spread: 17.5, homeMoneyLine: -900, awayMoneyLine: 600 },
      leaders: [],
    });
    assert.ok(props.length >= 2);
    assert.ok(props.every((card) => card.confidence === "HIGH" || card.confidence === "MEDIUM" || card.confidence === "LOW"));
    assert.ok(props.every((card) => !/\bis a lock\b/i.test(`${card.lean} ${card.why}`)));
    assert.ok(props.every((card) => !/^lock$/i.test(card.lean)));
    assert.ok(props.every((card) => card.why.length > 20));
    assert.ok(props.some((card) => card.market === "total" || card.market === "ML"));
    assert.ok(props.every((card) => card.playerName === null));
    assert.ok(props.every((card) => card.edge_vs_market === null));
    assert.ok(props.every((card) => card.evidence.length > 0 && card.inference.length > 0));
    assert.ok(props.every((card) => card.model_version.startsWith("harmon-line-sim")));
  });

  it("only names players who appear on published ESPN leaders — never invents player stats", () => {
    const home = rateTeam({
      stats: stats({ pointsPerGame: 30, pointsAllowedPerGame: 20 }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: "2-0",
    });
    const away = home;
    const sim = runGameSimulation({ home, away, homeField: true, seed: 3 });
    const leaders: LeaderLine[] = [
      { category: "Passing Yards", name: "Ty Simpson", displayValue: "34/53, 444 YDS, 1 TD", teamId: "333" },
    ];
    const withLeader = buildPropAngles({
      home,
      away,
      homeName: "Alabama",
      awayName: "USF",
      sim,
      market: null,
      leaders,
    });
    const playerCards = withLeader.filter((card) => card.playerName);
    assert.ok(playerCards.length >= 1);
    assert.ok(playerCards.every((card) => card.playerName === "Ty Simpson"));
    assert.ok(playerCards.every((card) => /444/.test(card.why)));

    const without = buildPropAngles({
      home,
      away,
      homeName: "Alabama",
      awayName: "USF",
      sim,
      market: null,
      leaders: [],
    });
    assert.ok(without.every((card) => card.playerName === null));
    assert.ok(without.every((card) => !/Ty Simpson/i.test(`${card.lean} ${card.why}`)));
  });

  it("keeps the props surface when no odds are published", () => {
    const home = rateTeam({
      stats: stats({ pointsPerGame: 28, pointsAllowedPerGame: 24, gamesPlayed: 2 }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: "1-1",
    });
    const away = rateTeam({
      stats: stats({ pointsPerGame: 26, pointsAllowedPerGame: 25, gamesPlayed: 2 }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: "1-1",
    });
    const sim = runGameSimulation({ home, away, homeField: true, seed: 9 });
    const props = buildPropAngles({
      home,
      away,
      homeName: "Home",
      awayName: "Away",
      sim,
      market: null,
      leaders: [],
    });
    assert.ok(props.length >= 1);
    assert.ok(props.every((card) => card.oddsAvailable === null));
    assert.ok(props.every((card) => card.edge_vs_market === null));
    assert.ok(props.every((card) => card.confidence === "LOW" || card.confidence === "MEDIUM"));
  });
});

describe("compositeOffense", () => {
  it("weights published PPG and yards instead of inventing a live score", () => {
    const high = compositeOffense(
      stats({ pointsPerGame: 40, rushingYardsPerGame: 220, passingYardsPerGame: 280, thirdDownPct: 50 }),
      40
    );
    const low = compositeOffense(
      stats({ pointsPerGame: 14, rushingYardsPerGame: 80, passingYardsPerGame: 140, thirdDownPct: 28 }),
      14
    );
    assert.ok(high > low);
  });
});

describe("buildMatchupAnalysis", () => {
  it("marks narrative as ANALYSIS and only cites numbers from the ratings", () => {
    const home = rateTeam({
      stats: stats({ pointsPerGame: 38.2, pointsAllowedPerGame: 16.4 }),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: 4,
      record: "2-0",
    });
    const away = rateTeam({
      stats: emptyTeamSeasonStats(),
      scheduleScoring: { games: 0, pointsPerGame: null, pointsAllowedPerGame: null },
      rank: null,
      record: null,
    });
    const analysis = buildMatchupAnalysis({
      home,
      away,
      homeName: "Alabama",
      awayName: "Mystery Town",
    });
    assert.equal(analysis.markedAs, "ANALYSIS");
    assert.match(analysis.headline, /ANALYSIS/);
    assert.ok(analysis.paragraphs.join(" ").includes("38.2"));
    assert.match(analysis.paragraphs.join(" "), /prior|not published|no published/i);
  });
});

describe("disclaimer", () => {
  it("states entertainment only, not financial advice, and 21+", () => {
    assert.match(BETTING_DISCLAIMER, /entertainment/i);
    assert.match(BETTING_DISCLAIMER, /not financial/i);
    assert.match(BETTING_DISCLAIMER, /21\+/);
    assert.match(BETTING_DISCLAIMER, /local laws/i);
    assert.match(BETTING_DISCLAIMER_LONG, /1-800-GAMBLER/);
    assert.match(BETTING_DISCLAIMER_LONG, /not guaranteed/i);
  });
});
