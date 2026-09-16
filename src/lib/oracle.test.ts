import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTeamSeasonStats } from "./espn-stats";
import { sportOracleHref } from "./board-url";
import {
  ORACLE_MODEL_VERSION,
  answerOracle,
  emptyOracleData,
  matchGamesForQuestion,
  parseOracleQuestion,
  parseOracleRequest,
} from "./oracle";
import type {
  GameSummary,
  LeaderLine,
  RankingPoll,
  TeamProfile,
  TeamScheduleGame,
  TeamSeasonStats,
  TeamSide,
} from "./types";

const FORBIDDEN =
  /pickcenter|winprob|win probability|\bats\b|paid.?odds|percentile|polymarket|pnl|moneyline|over\/under/i;

function side(
  partial: Partial<TeamSide> & Pick<TeamSide, "id" | "shortName" | "abbreviation" | "homeAway">
): TeamSide {
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
    state: "in",
    detail: "3rd Quarter",
    shortDetail: "Q3 8:42",
    period: 3,
    clock: "8:42",
    completed: false,
  },
  home: side({
    id: "251",
    shortName: "Texas",
    abbreviation: "TEX",
    homeAway: "home",
    rank: 1,
    score: 24,
    winner: false,
  }),
  away: side({
    id: "194",
    shortName: "Ohio State",
    abbreviation: "OSU",
    homeAway: "away",
    rank: 3,
    score: 17,
    winner: false,
  }),
  venue: "DKR",
  venueCity: "Austin, TX",
  broadcast: "ABC",
  situation: {
    down: 2,
    distance: 8,
    downDistanceText: "2nd & 8",
    possessionText: "TEX 32",
    possessionTeamId: "251",
    isRedZone: false,
    lastPlay: "Pass incomplete",
    homeTimeouts: 2,
    awayTimeouts: 3,
  },
  playByPlayAvailable: true,
  subdivision: "FBS",
  conferenceIds: ["8"],
};

const LEADERS: LeaderLine[] = [
  { category: "passingYards", name: "Quinn Ewers", displayValue: "212 YDS", teamId: "251" },
  { category: "rushingYards", name: "TreVeyon Henderson", displayValue: "88 YDS", teamId: "194" },
];

const TEAM: TeamProfile = {
  id: "333",
  name: "Alabama Crimson Tide",
  shortName: "Alabama",
  abbreviation: "ALA",
  color: "#9e1b32",
  altColor: "#ffffff",
  logo: "",
  record: "3-0",
  standing: "1st SEC",
  conferenceId: "8",
  conferenceName: "SEC",
  rank: 4,
  subdivision: "FBS",
};

const UPCOMING: TeamScheduleGame[] = [
  {
    id: "401900001",
    date: "2026-09-19T23:00Z",
    week: 4,
    state: "pre",
    shortDetail: "Sat 7:00 PM ET",
    venue: "Bryant-Denny",
    broadcast: "CBS",
    homeAway: "home",
    opponent: { id: "99", name: "Georgia", abbreviation: "UGA", logo: "" },
    teamScore: null,
    opponentScore: null,
    result: null,
  },
];

const RECENT: TeamScheduleGame[] = [
  {
    id: "401900000",
    date: "2026-09-12T16:00Z",
    week: 3,
    state: "post",
    shortDetail: "Final",
    venue: "Bryant-Denny",
    broadcast: "ABC",
    homeAway: "home",
    opponent: { id: "57", name: "Florida", abbreviation: "FLA", logo: "" },
    teamScore: 31,
    opponentScore: 17,
    result: "W",
  },
];

const POLL: RankingPoll = {
  id: "ap",
  espnId: "1",
  name: "AP Top 25",
  shortName: "AP",
  headline: "AP Top 25",
  week: 3,
  occurrence: "Week 3",
  ranks: [
    {
      rank: 1,
      previous: 1,
      points: 1548,
      record: "3-0",
      trend: { direction: "even", label: "-" },
      team: { id: "251", name: "Texas", abbreviation: "TEX", logo: "", color: null },
    },
    {
      rank: 3,
      previous: 2,
      points: 1420,
      record: "2-0",
      trend: { direction: "down", label: "-1" },
      team: { id: "194", name: "Ohio State", abbreviation: "OSU", logo: "", color: null },
    },
  ],
};

function stats(ppg: number, games: number): TeamSeasonStats {
  return { ...emptyTeamSeasonStats(), available: true, pointsPerGame: ppg, gamesPlayed: games };
}

function payloadOf(question: string, extra: Parameters<typeof answerOracle>[0]["data"] = emptyOracleData()) {
  return answerOracle({
    question,
    league: "cfb",
    data: extra,
    now: new Date("2026-09-16T19:00:00.000Z"),
  });
}

describe("parseOracleQuestion", () => {
  it("flags betting-adjacent language without treating a score question as a wager", () => {
    const bet = parseOracleQuestion("Should I bet the spread on Texas?");
    assert.equal(bet.bettingAdjacent, true);
    assert.ok(bet.intents.includes("betting"));
    const score = parseOracleQuestion("What's the score in Ohio State at Texas?");
    assert.equal(score.bettingAdjacent, false);
    assert.ok(score.intents.includes("score"));
  });

  it("detects rank, record, schedule, leaders, and situation intents", () => {
    assert.ok(parseOracleQuestion("Where is Alabama ranked in the AP poll?").intents.includes("rank"));
    assert.ok(parseOracleQuestion("What's Alabama's record?").intents.includes("record"));
    assert.ok(parseOracleQuestion("When do they play next?").intents.includes("schedule"));
    assert.ok(parseOracleQuestion("Who leads in passing yards?").intents.includes("leaders"));
    assert.ok(parseOracleQuestion("What's the down and distance?").intents.includes("situation"));
    assert.ok(parseOracleQuestion("What's their points per game?").intents.includes("stats"));
    assert.ok(parseOracleQuestion("Who is better on paper?").intents.includes("comparison"));
  });
});

describe("matchGamesForQuestion", () => {
  it("matches a published ESPN game when both school names appear", () => {
    const hits = matchGamesForQuestion("What's the score of Ohio State vs Texas?", [GAME]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.id, "401856682");
  });

  it("returns no match instead of inventing a slate", () => {
    const hits = matchGamesForQuestion("How did Boise State do?", [GAME]);
    assert.deepEqual(hits, []);
  });
});

describe("parseOracleRequest", () => {
  it("reads question plus optional league/gameId/teamId and ignores junk ids", () => {
    const parsed = parseOracleRequest({
      question: "What's the score?",
      league: "nba",
      gameId: "401234567",
      teamId: "13",
    });
    assert.equal(parsed.question, "What's the score?");
    assert.equal(parsed.league, "nba");
    assert.equal(parsed.gameId, "401234567");
    assert.equal(parsed.teamId, "13");
    const junk = parseOracleRequest({ question: "hi", gameId: "abc", teamId: "12x" });
    assert.equal(junk.gameId, null);
    assert.equal(junk.teamId, null);
    assert.equal(junk.league, "cfb");
  });
});

describe("answerOracle", () => {
  it("answers a live score from published ESPN numbers only", () => {
    const out = payloadOf("What's the score?", { ...emptyOracleData(), game: GAME, endpoints: ["summary"] });
    assert.equal(out.demo, false);
    assert.equal(out.empty, false);
    assert.equal(out.modelVersion, ORACLE_MODEL_VERSION);
    assert.equal(out.generatedAt, "2026-09-16T19:00:00.000Z");
    assert.equal(out.grounded.gameId, "401856682");
    assert.match(out.answer.headline, /OHIO STATE|OSU/i);
    assert.match(out.answer.summary, /17/);
    assert.match(out.answer.summary, /24/);
    assert.ok(out.evidence.some((row) => row.kind === "observed" && /17/.test(row.text) && /24/.test(row.text)));
    assert.ok(out.evidence.every((row) => row.kind === "observed"));
    assert.doesNotMatch(JSON.stringify(out), FORBIDDEN);
  });

  it("returns an honest empty when scores are missing instead of inventing 0-0", () => {
    const unscored: GameSummary = {
      ...GAME,
      home: { ...GAME.home, score: null },
      away: { ...GAME.away, score: null },
      status: { ...GAME.status, state: "pre", shortDetail: "Sat 7:30 PM ET", detail: "Scheduled" },
      situation: null,
    };
    const out = payloadOf("What's the score?", { ...emptyOracleData(), game: unscored });
    assert.equal(out.demo, false);
    assert.equal(out.empty, true);
    assert.match(out.answer.headline, /NOT ON THIS FEED/i);
    assert.match(out.honesty.detail, /not on this feed|not published/i);
    const blob = JSON.stringify(out);
    assert.doesNotMatch(blob, /\b0-0\b/);
    assert.doesNotMatch(blob, FORBIDDEN);
    assert.ok(!out.evidence.some((row) => /\b0\b/.test(row.text) && /score/i.test(row.text)));
  });

  it("says a game is not final instead of naming a winner from missing scores", () => {
    const pre: GameSummary = {
      ...GAME,
      status: { ...GAME.status, state: "pre", completed: false, shortDetail: "Sat 7:30 PM ET" },
      home: { ...GAME.home, score: null, winner: false },
      away: { ...GAME.away, score: null, winner: false },
      situation: null,
    };
    const out = payloadOf("Who won?", { ...emptyOracleData(), game: pre });
    assert.equal(out.empty, true);
    assert.doesNotMatch(out.answer.summary, /Texas won|Ohio State won/i);
    assert.match(out.answer.summary, /not final|not on this feed|not published/i);
  });

  it("names a winner only when ESPN marked the result", () => {
    const finalGame: GameSummary = {
      ...GAME,
      status: {
        state: "post",
        detail: "Final",
        shortDetail: "Final",
        period: 4,
        clock: "0:00",
        completed: true,
      },
      home: { ...GAME.home, score: 31, winner: true },
      away: { ...GAME.away, score: 14, winner: false },
      situation: null,
    };
    const out = payloadOf("Who won?", { ...emptyOracleData(), game: finalGame });
    assert.equal(out.empty, false);
    assert.match(out.answer.summary, /Texas/i);
    assert.match(out.answer.summary, /31/);
    assert.match(out.answer.summary, /14/);
  });

  it("grounds record and rank on the fetched team payload", () => {
    const out = payloadOf("What's Alabama's record and rank?", {
      ...emptyOracleData(),
      team: TEAM,
      endpoints: ["/teams/333"],
    });
    assert.equal(out.grounded.teamId, "333");
    assert.match(out.answer.summary, /3-0/);
    assert.match(out.answer.summary, /4/);
    assert.ok(out.evidence.some((row) => /3-0/.test(row.text)));
    assert.ok(out.evidence.some((row) => /#?4/.test(row.text)));
  });

  it("uses AP ranks when present and admits when a school is not on the poll", () => {
    const ranked = payloadOf("Where is Ohio State ranked?", {
      ...emptyOracleData(),
      rankings: POLL,
      endpoints: ["/rankings"],
    });
    assert.equal(ranked.empty, false);
    assert.match(ranked.answer.summary, /3/);
    const missing = payloadOf("Where is Boise State ranked?", {
      ...emptyOracleData(),
      rankings: POLL,
    });
    assert.equal(missing.empty, true);
    assert.match(missing.answer.headline, /NOT ON THIS FEED/i);
    assert.doesNotMatch(JSON.stringify(missing), /percentile/i);
  });

  it("copies published leaders and live situation, or labels them missing", () => {
    const hit = payloadOf("Who leads and what's the down and distance?", {
      ...emptyOracleData(),
      game: GAME,
      leaders: LEADERS,
    });
    assert.ok(hit.evidence.some((row) => /Quinn Ewers/.test(row.text)));
    assert.ok(hit.evidence.some((row) => /2nd & 8/.test(row.text)));
    const miss = payloadOf("Who leads and what's the situation?", {
      ...emptyOracleData(),
      game: { ...GAME, situation: null },
      leaders: [],
    });
    assert.ok(miss.evidence.some((row) => /leaders not on this feed/i.test(row.text)));
    assert.ok(miss.evidence.some((row) => /situation not on this feed/i.test(row.text)));
  });

  it("answers next game from the published schedule and never invents a score", () => {
    const out = payloadOf("When do they play next?", {
      ...emptyOracleData(),
      team: TEAM,
      upcoming: UPCOMING,
      recent: RECENT,
    });
    assert.match(out.answer.summary, /Georgia/i);
    assert.ok(out.evidence.some((row) => /W 31–17|W 31-17/i.test(row.text) || /31/.test(row.text)));
    const emptySched = payloadOf("When do they play next?", {
      ...emptyOracleData(),
      team: TEAM,
      upcoming: [],
      recent: [],
    });
    assert.equal(emptySched.empty, true);
    assert.match(emptySched.honesty.detail, /not on this feed|not published/i);
  });

  it("quotes season PPG only when published and labels CFBD fills", () => {
    const out = payloadOf("What's their points per game?", {
      ...emptyOracleData(),
      team: TEAM,
      teamStats: stats(41.5, 3),
      cfbdConfigured: true,
      cfbdFilled: ["pointsAllowedPerGame"],
    });
    assert.match(out.answer.summary, /41\.5/);
    assert.ok(out.evidence.some((row) => /41\.5/.test(row.text)));
    assert.ok(out.evidence.some((row) => /CFBD filled/i.test(row.text)));
    const blank = payloadOf("What's their points per game?", {
      ...emptyOracleData(),
      team: TEAM,
      teamStats: emptyTeamSeasonStats(),
      cfbdConfigured: false,
    });
    assert.equal(blank.empty, true);
    assert.doesNotMatch(JSON.stringify(blank), /41\.5|sample size/i);
  });

  it("separates observed evidence from labeled model inference on a comparison", () => {
    const out = payloadOf("Who is better, Ohio State or Texas?", {
      ...emptyOracleData(),
      game: GAME,
      homeStats: stats(38, 3),
      awayStats: stats(41.5, 3),
    });
    assert.ok(out.inference.length > 0);
    assert.ok(out.inference.every((row) => row.kind === "model"));
    assert.ok(out.inference.every((row) => row.badge === "INFERENCE" || row.badge === "SIMULATION"));
    for (const row of out.evidence) {
      assert.doesNotMatch(row.text, /projected|win probabilit|model mean|percentile/i);
    }
    assert.doesNotMatch(JSON.stringify(out), FORBIDDEN);
  });

  it("uses published poll ranks for a comparison when the summary omitted curatedRank", () => {
    const unranked: GameSummary = {
      ...GAME,
      home: { ...GAME.home, rank: null },
      away: { ...GAME.away, rank: null },
    };
    const out = payloadOf("Who is better on paper?", {
      ...emptyOracleData(),
      game: unranked,
      rankings: POLL,
    });
    assert.equal(out.empty, false);
    assert.ok(out.evidence.some((row) => /#1/.test(row.text) && /Texas/i.test(row.text)));
    assert.ok(out.inference.some((row) => row.badge === "INFERENCE" && /Texas/i.test(row.text)));
  });

  it("adds the 1-800-GAMBLER disclaimer for betting-adjacent questions and still refuses odds", () => {
    const out = payloadOf("Should I bet the spread and take Texas ATS?", {
      ...emptyOracleData(),
      game: GAME,
    });
    assert.equal(out.disclaimer?.includes("1-800-GAMBLER") || out.disclaimerLong?.includes("1-800-GAMBLER"), true);
    assert.match(out.disclaimerLong ?? "", /1-800-GAMBLER/);
    assert.match(out.answer.summary, /does not|not on this|no odds|no spread/i);
    assert.doesNotMatch(JSON.stringify(out), /pickcenter|winprob/i);
    assert.ok(out.evidence.some((row) => /odds|spread|ATS|winprob/i.test(row.text)));
  });

  it("stays honestly empty when nothing on the feed matches", () => {
    const out = payloadOf("Did the Moon University beat Mars Tech?");
    assert.equal(out.demo, false);
    assert.equal(out.empty, true);
    assert.equal(out.source, "espn");
    assert.match(out.answer.headline, /NOT ON THIS FEED/i);
    assert.equal(out.inference.length, 0);
    assert.doesNotMatch(JSON.stringify(out), FORBIDDEN);
  });

  it("does not invent percentiles or sample sizes when stats are blank", () => {
    const out = payloadOf("What percentile is their offense and what's the sample size?", {
      ...emptyOracleData(),
      game: GAME,
      homeStats: emptyTeamSeasonStats(),
      awayStats: emptyTeamSeasonStats(),
    });
    const blob = JSON.stringify({
      answer: out.answer,
      evidence: out.evidence,
      inference: out.inference,
      honesty: out.honesty,
      coverage: out.coverage,
    });
    assert.doesNotMatch(blob, /percentile/i);
    assert.doesNotMatch(blob, /sample size/i);
    assert.match(out.honesty.detail, /not on this feed|not published|cannot verify/i);
  });
});

describe("sportOracleHref", () => {
  it("keeps CFB at /oracle and preserves league plus grounding ids", () => {
    assert.equal(sportOracleHref("cfb"), "/oracle");
    assert.equal(sportOracleHref("mbb"), "/oracle?league=mbb");
    assert.equal(
      sportOracleHref("nfl", { gameId: "401", teamId: "2", q: "score" }),
      "/oracle?league=nfl&gameId=401&teamId=2&q=score"
    );
  });
});
