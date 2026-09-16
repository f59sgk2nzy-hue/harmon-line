import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sportOracleHref } from "./board-url";
import {
  answerOracle,
  isBettingQuestion,
  parseOracleQuestion,
  type OracleFeeds,
} from "./oracle";
import type {
  GameDetailResponse,
  GameSummary,
  LeaderLine,
  RankingsResponse,
  ScoreboardResponse,
  TeamPageResponse,
  TeamSide,
} from "./types";

const FORBIDDEN = /pnl|polymarket|monte.?carlo|winprob|pickcenter|\bats\b|paid.?odds/i;

function side(
  partial: Partial<TeamSide> & Pick<TeamSide, "id" | "shortName" | "abbreviation" | "homeAway">
): TeamSide {
  return {
    name: partial.name ?? partial.shortName,
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

function game(partial: Partial<GameSummary> & Pick<GameSummary, "id" | "home" | "away">): GameSummary {
  return {
    name: `${partial.away.shortName} at ${partial.home.shortName}`,
    shortName: `${partial.away.abbreviation} @ ${partial.home.abbreviation}`,
    date: "2026-09-12T23:30Z",
    week: 3,
    status: {
      state: "post",
      detail: "Final",
      shortDetail: "Final",
      period: 4,
      clock: "0:00",
      completed: true,
    },
    venue: "DKR",
    venueCity: "Austin, TX",
    broadcast: "ABC",
    situation: null,
    playByPlayAvailable: false,
    subdivision: "FBS",
    conferenceIds: ["8"],
    ...partial,
  };
}

const OSU_TEX = game({
  id: "401856682",
  away: side({
    id: "194",
    shortName: "Ohio State",
    name: "Ohio State Buckeyes",
    abbreviation: "OSU",
    homeAway: "away",
    rank: 3,
    score: 24,
    winner: true,
    record: "2-0",
  }),
  home: side({
    id: "251",
    shortName: "Texas",
    name: "Texas Longhorns",
    abbreviation: "TEX",
    homeAway: "home",
    rank: 1,
    score: 21,
    winner: false,
    record: "1-1",
  }),
});

const PRE_GAME = game({
  id: "401856700",
  status: {
    state: "pre",
    detail: "Sat 3:30 PM ET",
    shortDetail: "Sat 3:30 PM ET",
    period: null,
    clock: null,
    completed: false,
  },
  away: side({
    id: "333",
    shortName: "Alabama",
    name: "Alabama Crimson Tide",
    abbreviation: "ALA",
    homeAway: "away",
    rank: 4,
    score: null,
    record: "2-0",
  }),
  home: side({
    id: "61",
    shortName: "Georgia",
    name: "Georgia Bulldogs",
    abbreviation: "UGA",
    homeAway: "home",
    rank: 2,
    score: null,
    record: "2-0",
  }),
});

const LAKERS = game({
  id: "401809937",
  week: null,
  subdivision: "NBA",
  conferenceIds: [],
  status: {
    state: "in",
    detail: "Q3 4:12",
    shortDetail: "Q3 4:12",
    period: 3,
    clock: "4:12",
    completed: false,
  },
  away: side({
    id: "13",
    shortName: "Lakers",
    name: "Los Angeles Lakers",
    abbreviation: "LAL",
    homeAway: "away",
    conferenceId: null,
    conferenceName: null,
    score: 88,
    record: "4-2",
  }),
  home: side({
    id: "2",
    shortName: "Celtics",
    name: "Boston Celtics",
    abbreviation: "BOS",
    homeAway: "home",
    conferenceId: null,
    conferenceName: null,
    score: 91,
    record: "5-1",
  }),
});

function board(games: GameSummary[], league: ScoreboardResponse["league"] = "cfb"): ScoreboardResponse {
  return {
    source: "espn",
    demo: false,
    league,
    date: "20260912",
    division: "d1",
    week: 3,
    seasonYear: 2026,
    seasonType: 2,
    weeks: [],
    view: "date",
    generatedAt: "2026-09-13T12:00:00.000Z",
    games,
    conferences: [],
    liveCount: games.filter((row) => row.status.state === "in").length,
    coverage: { headline: "test board", detail: "fixture" },
  };
}

function detail(
  summary: GameSummary,
  extras: { leaders?: LeaderLine[] } = {}
): GameDetailResponse {
  return {
    source: "espn",
    demo: false,
    league: summary.subdivision === "NBA" ? "nba" : "cfb",
    generatedAt: "2026-09-13T12:00:00.000Z",
    game: summary,
    scoringPlays: [],
    drives: [],
    plays: [],
    leaders: extras.leaders ?? [],
    playByPlayAvailable: false,
    coverage: { headline: "Play-by-play not published", detail: "No PBP on this fixture." },
    teamStats: [],
    playerBox: { available: false, teams: [] },
    standings: null,
    news: { article: null, articles: [] },
  };
}

function feeds(options: {
  scoreboard?: ScoreboardResponse;
  detail?: GameDetailResponse | null;
  rankings?: RankingsResponse | null;
  team?: TeamPageResponse | null;
  cfbdConfigured?: boolean;
  cfbdStats?: Record<string, number>;
}): OracleFeeds {
  const scoreboard = options.scoreboard ?? board([OSU_TEX, PRE_GAME]);
  return {
    getScoreboard: async () => scoreboard,
    getGameDetail: async (eventId) => {
      if (options.detail && options.detail.game.id === eventId) return options.detail;
      const match = scoreboard.games.find((row) => row.id === eventId);
      if (!match) throw new Error("Game not found on ESPN");
      return detail(match);
    },
    getTeamPage: async () => {
      if (!options.team) throw new Error("Team not found on ESPN");
      return options.team;
    },
    getRankings: async () => {
      if (!options.rankings) throw new Error("Rankings not published");
      return options.rankings;
    },
    cfbdConfigured: options.cfbdConfigured ?? false,
    getCfbdSeasonStats: async () => options.cfbdStats ?? {},
  };
}

describe("parseOracleQuestion", () => {
  it("reads league + vs matchup from a CFB score question", () => {
    const parsed = parseOracleQuestion("What's the Ohio State vs Texas score?");
    assert.equal(parsed.league, "cfb");
    assert.equal(parsed.intent, "score");
    assert.equal(parsed.betting, false);
    assert.ok(parsed.needles.some((n) => /ohio state/i.test(n)));
    assert.ok(parsed.needles.some((n) => /texas/i.test(n)));
  });

  it("maps Lakers to the NBA board and Bama to CFB", () => {
    assert.equal(parseOracleQuestion("Lakers vs Celtics").league, "nba");
    assert.equal(parseOracleQuestion("Where is Bama ranked?").league, "cfb");
    assert.equal(parseOracleQuestion("Where is Bama ranked?").intent, "rank");
    assert.equal(parseOracleQuestion("Chiefs record this week", "cfb").league, "nfl");
  });

  it("flags betting, ATS, odds, and Polymarket language", () => {
    assert.equal(isBettingQuestion("does Ohio State cover -3.5 ATS?"), true);
    assert.equal(parseOracleQuestion("who covers the spread tonight").intent, "betting");
    assert.equal(parseOracleQuestion("polymarket on the chiefs").intent, "betting");
    assert.equal(parseOracleQuestion("winprob for texas").intent, "betting");
  });
});

describe("sportOracleHref", () => {
  it("keeps CFB oracle at /oracle and preserves sibling league plus query", () => {
    assert.equal(sportOracleHref("cfb"), "/oracle");
    assert.equal(sportOracleHref("mbb"), "/oracle?league=mbb");
    assert.equal(
      sportOracleHref("nba", "Lakers vs Celtics"),
      "/oracle?league=nba&q=Lakers+vs+Celtics"
    );
  });
});

describe("answerOracle", () => {
  it("answers a named CFB final from the scoreboard slice with demo false and split evidence/inference", async () => {
    const result = await answerOracle(
      { q: "What's the Ohio State vs Texas score?" },
      feeds({ scoreboard: board([OSU_TEX, PRE_GAME]) })
    );

    assert.equal(result.demo, false);
    assert.equal(result.source, "espn");
    assert.equal(result.league, "cfb");
    assert.equal(result.scope, "game");
    assert.ok(result.evidence.length > 0);
    assert.ok(result.inference.length > 0);
    assert.match(result.answerMarkdown, /evidence/i);
    assert.match(result.answerMarkdown, /inference/i);
    assert.match(result.evidence.join("\n"), /24/);
    assert.match(result.evidence.join("\n"), /21/);
    assert.match(result.evidence.join("\n"), /Ohio State/i);
    assert.match(result.evidence.join("\n"), /Texas/i);
    assert.ok(result.sources.some((src) => /espn/i.test(src.label)));
    assert.equal(result.rgDisclaimer, null);
    assert.doesNotMatch(JSON.stringify(result), FORBIDDEN);
  });

  it("does not treat ESPN pregame placeholder zeros as a published score", async () => {
    const scheduled = game({
      ...PRE_GAME,
      away: { ...PRE_GAME.away, score: 0 },
      home: { ...PRE_GAME.home, score: 0 },
    });
    const result = await answerOracle(
      { q: "Alabama vs Georgia score" },
      feeds({ scoreboard: board([scheduled]) })
    );
    const blob = result.evidence.join(" ");
    assert.match(blob, /not published|not on this feed/i);
    assert.doesNotMatch(blob, /\b0, .*0\b/);
  });

  it("does not invent 0-0 when ESPN omitted scores on a scheduled game", async () => {
    const result = await answerOracle(
      { q: "Alabama vs Georgia score" },
      feeds({ scoreboard: board([PRE_GAME]) })
    );
    const blob = `${result.evidence.join(" ")} ${result.answerMarkdown}`;
    assert.match(blob, /not on this feed|not published|no score|scores? (are|were) not/i);
    assert.doesNotMatch(blob, /\b0-0\b|\b0–0\b/);
    assert.ok(!result.evidence.some((line) => /\b0\b.*\b0\b/.test(line) && /score/i.test(line)));
  });

  it("returns an honest empty when the named team is not on this ESPN slice", async () => {
    const result = await answerOracle(
      { q: "What's the Boise State score?" },
      feeds({ scoreboard: board([OSU_TEX]) })
    );
    assert.equal(result.scope, "empty");
    assert.equal(result.demo, false);
    assert.deepEqual(result.evidence, []);
    assert.match(result.answerMarkdown, /not on this feed/i);
    assert.doesNotMatch(result.answerMarkdown, /\bpercentile\b|\bsample size\b/i);
  });

  it("refuses betting advice and attaches the RG disclaimer", async () => {
    const result = await answerOracle(
      { q: "Does Ohio State cover the spread ATS?" },
      feeds({ scoreboard: board([OSU_TEX]) })
    );
    assert.equal(result.scope, "refused");
    assert.deepEqual(result.evidence, []);
    assert.match(result.inference.join("\n"), /refus|not give betting|no betting advice/i);
    assert.ok(result.rgDisclaimer);
    assert.match(result.rgDisclaimer, /21\+/);
    assert.match(result.rgDisclaimer, /1-800-GAMBLER|entertainment/i);
    assert.doesNotMatch(JSON.stringify(result), /polymarket|pickcenter|winprob/i);
  });

  it("answers an NBA live score from that league's scoreboard slice", async () => {
    const result = await answerOracle(
      { q: "Lakers vs Celtics score" },
      feeds({ scoreboard: board([LAKERS], "nba") })
    );
    assert.equal(result.league, "nba");
    assert.equal(result.scope, "game");
    assert.match(result.evidence.join("\n"), /88/);
    assert.match(result.evidence.join("\n"), /91/);
    assert.match(result.evidence.join("\n"), /Lakers/i);
  });

  it("copies published leaders from a summary slice and never invents video or percentiles", async () => {
    const result = await answerOracle(
      { q: "Who led Ohio State vs Texas?" },
      feeds({
        scoreboard: board([OSU_TEX]),
        detail: detail(OSU_TEX, {
          leaders: [
            {
              category: "passingYards",
              name: "Will Howard",
              displayValue: "18/24, 221 YDS, 2 TD",
              teamId: "194",
            },
          ],
        }),
      })
    );
    assert.equal(result.scope, "game");
    assert.match(result.evidence.join("\n"), /Will Howard/);
    assert.match(result.evidence.join("\n"), /221 YDS/);
    const blob = JSON.stringify(result);
    assert.doesNotMatch(blob, /percentile|p90|sample size|youtube\.com\/watch/i);
    assert.doesNotMatch(blob, FORBIDDEN);
  });

  it("answers a published AP rank without inventing poll points", async () => {
    const rankings: RankingsResponse = {
      source: "espn",
      demo: false,
      league: "cfb",
      generatedAt: "2026-09-13T12:00:00.000Z",
      week: 3,
      seasonYear: 2026,
      poll: "ap",
      polls: [],
      selected: {
        id: "ap",
        espnId: "1",
        name: "AP Top 25",
        shortName: "AP",
        headline: "AP Top 25",
        week: 3,
        occurrence: "Week 3",
        ranks: [
          {
            rank: 4,
            previous: 5,
            points: 1422,
            record: "2-0",
            trend: { direction: "up", label: "+1" },
            team: {
              id: "333",
              name: "Alabama Crimson Tide",
              abbreviation: "ALA",
              logo: "",
              color: null,
            },
          },
        ],
      },
      coverage: { headline: "AP", detail: "fixture" },
    };
    const result = await answerOracle(
      { q: "Where is Alabama ranked?" },
      feeds({ scoreboard: board([PRE_GAME]), rankings })
    );
    assert.equal(result.scope, "rankings");
    assert.match(result.evidence.join("\n"), /#4|# 4|ranked 4|rank 4/i);
    assert.match(result.evidence.join("\n"), /1422/);
    assert.doesNotMatch(result.inference.join("\n"), /invent|percentile/i);
  });

  it("does not invent CFBD cells when the key is missing", async () => {
    const result = await answerOracle(
      { q: "Ohio State points per game" },
      feeds({ scoreboard: board([OSU_TEX]), cfbdConfigured: false, cfbdStats: { pointsPerGame: 99 } })
    );
    const blob = JSON.stringify(result);
    assert.doesNotMatch(blob, /99/);
    assert.doesNotMatch(blob, /cfbd-season-stats/);
  });

  it("uses CFBD only to fill a published cell when the key is present", async () => {
    const result = await answerOracle(
      { q: "Ohio State points per game" },
      feeds({
        scoreboard: board([OSU_TEX]),
        cfbdConfigured: true,
        cfbdStats: { pointsPerGame: 41.5 },
      })
    );
    assert.match(result.evidence.join("\n"), /41\.5/);
    assert.ok(result.sources.some((src) => src.kind === "cfbd"));
  });

  it("labels who-wins forecasts as inference, not a published score", async () => {
    const result = await answerOracle(
      { q: "Who will win Alabama vs Georgia?" },
      feeds({ scoreboard: board([PRE_GAME]) })
    );
    assert.match(result.inference.join("\n"), /inference|simulation|not a live score|does not forecast/i);
    assert.doesNotMatch(result.evidence.join("\n"), /will win/i);
    assert.doesNotMatch(JSON.stringify(result), FORBIDDEN);
  });
});
