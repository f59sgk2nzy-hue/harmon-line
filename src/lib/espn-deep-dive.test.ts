import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleDeepDive } from "./espn-deep-dive";
import type { GameSummary, TeamSide } from "./types";

function side(partial: Partial<TeamSide> & Pick<TeamSide, "id" | "shortName" | "abbreviation" | "homeAway">): TeamSide {
  return {
    name: partial.shortName,
    score: null,
    record: "2-0",
    rank: null,
    color: null,
    altColor: null,
    logo: "",
    conferenceId: "8",
    conferenceName: "SEC",
    winner: false,
    linescores: [],
    ...partial,
  };
}

const GAME: GameSummary = {
  id: "401856682",
  name: "Ohio State at Texas",
  shortName: "OSU @ TEX",
  date: "2026-09-12T23:30Z",
  week: 3,
  status: {
    state: "pre",
    detail: "Scheduled",
    shortDetail: "Sat 7:30 PM ET",
    period: null,
    clock: null,
    completed: false,
  },
  home: side({ id: "251", shortName: "Texas", abbreviation: "TEX", homeAway: "home", rank: 1 }),
  away: side({ id: "194", shortName: "Ohio State", abbreviation: "OSU", homeAway: "away", rank: 3 }),
  venue: "DKR",
  venueCity: "Austin, TX",
  broadcast: "ABC",
  situation: null,
  playByPlayAvailable: false,
  subdivision: "FBS",
  conferenceIds: ["8"],
};

const STATS = {
  results: {
    stats: {
      categories: [
        { name: "scoring", stats: [{ name: "totalPointsPerGame", value: 41.5 }] },
        { name: "general", stats: [{ name: "gamesPlayed", value: 2 }] },
        { name: "rushing", stats: [{ name: "rushingYardsPerGame", value: 150 }] },
      ],
    },
    opponent: [{ name: "scoring", stats: [{ name: "totalPointsPerGame", value: 17 }] }],
  },
};

describe("assembleDeepDive", () => {
  it("emits HarmonLinePropCards with null market edge and separated evidence vs inference", () => {
    const dive = assembleDeepDive({
      game: GAME,
      leaders: [],
      homeStatsRaw: STATS,
      awayStatsRaw: STATS,
      homeSchedule: [],
      awaySchedule: [],
      marketRaw: { pickcenter: [{ provider: { name: "DraftKings" }, details: "TEX -2.5", overUnder: 50.5 }] },
      cfbdConfigured: false,
      now: new Date("2026-09-13T12:00:00.000Z"),
    });

    assert.equal(dive.demo, false);
    assert.equal(dive.simulation.label, "SIMULATION");
    assert.ok(dive.simulation.trials >= 5000 && dive.simulation.trials <= 10_000);
    assert.ok(dive.simulation.homeWinPct > 0 && dive.simulation.awayWinPct > 0);
    assert.ok(dive.simulation.marginLow < dive.simulation.marginHigh);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(dive.simulation.confidence));
    assert.match(dive.disclaimerLong, /1-800-GAMBLER/);
    assert.match(dive.coverage.cfbd.headline, /NOT SET/);
    assert.match(dive.coverage.odds.headline, /NO PAID ODDS|EDGE STILL NULL/);
    assert.match(dive.coverage.odds.detail, /edge_vs_market/);
    assert.match(dive.analysis.headline, /INFERENCE · ANALYSIS/);

    for (const line of dive.evidence) {
      assert.doesNotMatch(line, /projected|win probabilit|model mean|percentile band/i);
    }
    for (const line of dive.inference) {
      assert.doesNotMatch(line, /ESPN PPG|pickcenter/i);
    }

    assert.ok(dive.props.length >= 3);
    for (const card of dive.props) {
      assert.ok(["spread", "total", "ML", "player_prop"].includes(card.market));
      assert.equal(card.game.id, "401856682");
      assert.equal(card.edge_vs_market, null);
      assert.ok(card.evidence.length > 0);
      assert.ok(card.inference.length > 0);
      assert.ok(card.disclaimers.some((row) => /1-800-GAMBLER/.test(row)));
      assert.equal(card.data_as_of, "2026-09-13T12:00:00.000Z");
      assert.equal(card.model_version, dive.modelVersion);
      for (const line of card.evidence) {
        assert.doesNotMatch(line, /projected \d/i);
      }
    }
  });

  it("labels CFBD-filled cells as evidence and never pretends a missing key returned stats", () => {
    const dive = assembleDeepDive({
      game: GAME,
      leaders: [{ category: "Passing Yards", name: "Quinn Ewers", displayValue: "250 YDS" }],
      homeStatsRaw: {},
      awayStatsRaw: {},
      homeSchedule: [],
      awaySchedule: [],
      marketRaw: {},
      homeCfbd: { pointsPerGame: 33, pointsAllowedPerGame: 18 },
      awayCfbd: {},
      cfbdConfigured: true,
      now: new Date("2026-09-13T12:00:00.000Z"),
    });
    assert.match(dive.coverage.cfbd.headline, /merged|CFBD/i);
    assert.match(dive.coverage.stats.headline, /CFBD/);
    assert.match(dive.evidence.join(" "), /CFBD filled/);
    assert.ok(dive.simulation.inputsUsed.includes("cfbd-season-stats"));
    assert.ok(!dive.simulation.inputsUsed.includes("espn-team-statistics"));
    assert.equal(dive.homeStats.pointsPerGame, 33);
    assert.equal(dive.awayStats.pointsPerGame, null);
    const player = dive.props.filter((card) => card.market === "player_prop");
    assert.equal(player.length, 1);
    assert.equal(player[0]?.playerName, "Quinn Ewers");
    assert.ok(dive.props.every((card) => card.edge_vs_market === null));
  });

  it("keeps edge_vs_market null even when a reserved odds key is present", () => {
    const dive = assembleDeepDive({
      game: GAME,
      leaders: [],
      homeStatsRaw: STATS,
      awayStatsRaw: STATS,
      homeSchedule: [],
      awaySchedule: [],
      marketRaw: { pickcenter: [{ provider: { name: "DraftKings" }, details: "TEX -2.5", overUnder: 50.5 }] },
      cfbdConfigured: false,
      oddsConfigured: true,
      now: new Date("2026-09-13T12:00:00.000Z"),
    });
    assert.match(dive.coverage.odds.headline, /EDGE STILL NULL/);
    assert.match(dive.coverage.odds.detail, /no paid-odds adapter/i);
    assert.ok(dive.props.every((card) => card.edge_vs_market === null));
  });
});
