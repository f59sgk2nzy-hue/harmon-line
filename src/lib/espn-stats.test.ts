import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextDeepDiveGameId,
  oddsCoverage,
  oddsKeyConfigured,
  parsePublishedMarket,
  parseTeamSeasonStats,
  scoringFromSchedule,
  statsCoverage,
} from "./espn-stats";
import type { TeamScheduleGame } from "./types";

const ALA_STATS = {
  results: {
    stats: {
      categories: [
        {
          name: "passing",
          stats: [
            { name: "completionPct", value: 63.6, displayValue: "63.6" },
            { name: "netPassingYardsPerGame", value: 224, displayValue: "224.0" },
            { name: "yardsPerPassAttempt", value: 8.1, displayValue: "8.1" },
            { name: "passingTouchdowns", value: 1, displayValue: "1" },
            { name: "interceptions", value: 2, displayValue: "2" },
          ],
        },
        {
          name: "rushing",
          stats: [
            { name: "rushingYardsPerGame", value: 191, displayValue: "191.0" },
            { name: "yardsPerRushAttempt", value: 4.3, displayValue: "4.3" },
            { name: "rushingTouchdowns", value: 8, displayValue: "8" },
          ],
        },
        {
          name: "miscellaneous",
          stats: [
            { name: "thirdDownConvPct", value: 50, displayValue: "50.00" },
            { name: "turnOverDifferential", value: 0, displayValue: "0" },
            { name: "totalGiveaways", value: 4, displayValue: "4" },
            { name: "totalTakeaways", value: 4, displayValue: "4" },
          ],
        },
        {
          name: "defensive",
          stats: [{ name: "sacks", value: 7, displayValue: "7" }],
        },
        {
          name: "general",
          stats: [{ name: "gamesPlayed", value: 2, displayValue: "2" }],
        },
        {
          name: "kicking",
          stats: [
            { name: "fieldGoalsMade", value: 5, displayValue: "5" },
            { name: "fieldGoalAttempts", value: 5, displayValue: "5" },
          ],
        },
        {
          name: "scoring",
          stats: [
            { name: "totalPointsPerGame", value: 46.5, displayValue: "46.5" },
            { name: "totalPoints", value: 93, displayValue: "93" },
            { name: "totalTouchdowns", value: 9, displayValue: "9" },
          ],
        },
      ],
    },
    opponent: [
      {
        name: "passing",
        stats: [{ name: "netPassingYardsPerGame", value: 153, displayValue: "153.0" }],
      },
      {
        name: "rushing",
        stats: [{ name: "rushingYardsPerGame", value: 98, displayValue: "98.0" }],
      },
      {
        name: "scoring",
        stats: [{ name: "totalPointsPerGame", value: 17.5, displayValue: "17.5" }],
      },
    ],
  },
};

describe("parseTeamSeasonStats", () => {
  it("reads scoring rates and key efficiency stats from ESPN team statistics JSON", () => {
    const stats = parseTeamSeasonStats(ALA_STATS);
    assert.equal(stats.available, true);
    assert.equal(stats.gamesPlayed, 2);
    assert.equal(stats.pointsPerGame, 46.5);
    assert.equal(stats.pointsAllowedPerGame, 17.5);
    assert.equal(stats.rushingYardsPerGame, 191);
    assert.equal(stats.passingYardsPerGame, 224);
    assert.equal(stats.yardsPerRush, 4.3);
    assert.equal(stats.thirdDownPct, 50);
    assert.equal(stats.rushingTouchdowns, 8);
    assert.equal(stats.sacks, 7);
    assert.equal(stats.fieldGoalsMade, 5);
  });

  it("returns an honest empty stats object instead of inventing numbers", () => {
    const empty = parseTeamSeasonStats({});
    assert.equal(empty.available, false);
    assert.equal(empty.gamesPlayed, null);
    assert.equal(empty.pointsPerGame, null);
    assert.equal(empty.pointsAllowedPerGame, null);
    assert.equal(empty.rushingTouchdowns, null);
    assert.match(statsCoverage(empty, "FBS").headline, /NOT ON THIS FEED|NOT PUBLISHED/i);
  });
});

describe("parsePublishedMarket", () => {
  it("reads ESPN pickcenter details and over/under when published", () => {
    const market = parsePublishedMarket({
      pickcenter: [
        {
          provider: { name: "DraftKings" },
          details: "MIZ -4",
          overUnder: 51.5,
          spread: 4,
          awayTeamOdds: { moneyLine: -198, favorite: true },
          homeTeamOdds: { moneyLine: 164, favorite: false },
        },
      ],
    });
    assert.ok(market);
    assert.equal(market?.provider, "DraftKings");
    assert.equal(market?.details, "MIZ -4");
    assert.equal(market?.overUnder, 51.5);
    assert.equal(market?.awayMoneyLine, -198);
    assert.equal(market?.homeMoneyLine, 164);
  });

  it("returns null when ESPN omitted pickcenter — never invents a line", () => {
    assert.equal(parsePublishedMarket({}), null);
    assert.equal(parsePublishedMarket({ pickcenter: [] }), null);
  });
});

describe("scoringFromSchedule", () => {
  it("averages published final scores and ignores games without scores", () => {
    const games: TeamScheduleGame[] = [
      {
        id: "1",
        date: "2026-09-05T16:00Z",
        week: 1,
        state: "post",
        shortDetail: "Final",
        venue: null,
        broadcast: null,
        homeAway: "home",
        opponent: { id: "2", name: "ECU", abbreviation: "ECU", logo: "" },
        teamScore: 48,
        opponentScore: 10,
        result: "W",
      },
      {
        id: "2",
        date: "2026-09-19T16:00Z",
        week: 3,
        state: "pre",
        shortDetail: "TBD",
        venue: null,
        broadcast: null,
        homeAway: "home",
        opponent: { id: "3", name: "FSU", abbreviation: "FSU", logo: "" },
        teamScore: null,
        opponentScore: null,
        result: null,
      },
    ];
    const scoring = scoringFromSchedule(games);
    assert.equal(scoring.games, 1);
    assert.equal(scoring.pointsPerGame, 48);
    assert.equal(scoring.pointsAllowedPerGame, 10);
  });

  it("does not invent scoring rates from an empty schedule", () => {
    const scoring = scoringFromSchedule([]);
    assert.equal(scoring.games, 0);
    assert.equal(scoring.pointsPerGame, null);
    assert.equal(scoring.pointsAllowedPerGame, null);
  });
});

describe("nextDeepDiveGameId", () => {
  it("prefers the next upcoming game, then the most recent, and stays empty when ESPN has neither", () => {
    assert.equal(nextDeepDiveGameId([{ id: "upcoming-1" }], [{ id: "recent-1" }]), "upcoming-1");
    assert.equal(nextDeepDiveGameId([], [{ id: "recent-1" }]), "recent-1");
    assert.equal(nextDeepDiveGameId([], []), null);
  });
});

describe("oddsKeyConfigured", () => {
  it("is false when ODDS_API_KEY is missing so props stay without live edge", () => {
    assert.equal(oddsKeyConfigured({}), false);
    assert.equal(oddsKeyConfigured({ ODDS_API_KEY: "   " }), false);
    assert.equal(oddsKeyConfigured({ ODDS_API_KEY: "secret" }), true);
  });

  it("never treats a present key as a live market edge in v0", () => {
    const present = oddsCoverage(true);
    const absent = oddsCoverage(false);
    assert.match(present.detail, /edge_vs_market stays null/);
    assert.match(absent.detail, /edge_vs_market is null/);
  });
});
