import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachResearchGraphs,
  loadWinProbSeries,
  parseWinProbability,
  type WinProbSeries,
} from "./espn-winprob";
import { loadResearchFeed } from "./research";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BETTING = /"pickcenter"|"againstTheSpread"|"odds"|polymarket|"pnl"|"wpa"/i;

const MLB_SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: { abbreviation: "CLE", displayName: "Cleveland Guardians" },
            score: "5",
          },
          {
            homeAway: "away",
            team: { abbreviation: "CHW", displayName: "Chicago White Sox" },
            score: "3",
          },
        ],
      },
    ],
  },
  winprobability: [
    { playId: "p1", homeWinPercentage: 0.55, tiePercentage: 0 },
    { playId: "p2", homeWinPercentage: 0.4, tiePercentage: 0 },
    { playId: "p3", homeWinPercentage: 0.88, tiePercentage: 0 },
  ],
  plays: [
    {
      id: "p1",
      text: "Kwan grounds out.",
      homeScore: 0,
      awayScore: 0,
      period: { number: 1, type: "Top" },
    },
    {
      id: "p2",
      text: "Pham homered to left center.",
      homeScore: 0,
      awayScore: 3,
      period: { number: 5, type: "Top" },
      scoringPlay: true,
    },
    {
      id: "p3",
      text: "Halpin homered to right center.",
      homeScore: 5,
      awayScore: 3,
      period: { number: 6, type: "Bottom" },
      scoringPlay: true,
    },
  ],
  odds: { details: "CLE -145" },
  pickcenter: [{ spread: -1.5 }],
  againstTheSpread: [{ records: [] }],
  predictor: { homeTeam: { gameProjection: 6 } },
};

const NFL_SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: { abbreviation: "CIN", displayName: "Cincinnati Bengals" },
          },
          {
            homeAway: "away",
            team: { abbreviation: "TB", displayName: "Tampa Bay Buccaneers" },
          },
        ],
      },
    ],
  },
  winprobability: [
    { playId: "40187292540", homeWinPercentage: 0.62, tiePercentage: 0 },
    { playId: "401872925545", homeWinPercentage: 0.78, tiePercentage: 0 },
  ],
  drives: {
    previous: [
      {
        plays: [
          {
            id: "40187292540",
            text: "Kickoff",
            homeScore: 0,
            awayScore: 0,
            period: { number: 1 },
            clock: { displayValue: "15:00" },
          },
          {
            id: "401872925545",
            text: "Mayfield sacked, fumble recovered by Cincinnati.",
            homeScore: 0,
            awayScore: 0,
            period: { number: 2 },
            clock: { displayValue: "8:12" },
          },
        ],
      },
    ],
  },
};

function assertHonestEmpty(series: WinProbSeries) {
  assert.equal(series.source, "espn");
  assert.equal(series.demo, false);
  assert.equal(series.available, false);
  assert.deepEqual(series.points, []);
  assert.deepEqual(series.tippingPoints, []);
  assert.equal(series.honesty.headline, "WIN PROBABILITY NOT ON THIS FEED");
  assert.equal(series.rgFootnote, null);
  assert.doesNotMatch(JSON.stringify(series), BETTING);
}

describe("parseWinProbability", () => {
  it("returns WIN PROBABILITY NOT ON THIS FEED when ESPN omitted the series", () => {
    const series = parseWinProbability(
      { header: MLB_SUMMARY.header, predictor: { homeTeam: { gameProjection: 6 } } },
      { league: "mlb", gameId: "401816960" }
    );
    assertHonestEmpty(series);
    assert.equal(series.gameId, "401816960");
    assert.equal(series.league, "mlb");
  });

  it("maps ESPN winprobability points and joins PBP labels without inventing extras", () => {
    const series = parseWinProbability(MLB_SUMMARY, { league: "mlb", gameId: "401816960" });
    assert.equal(series.source, "espn");
    assert.equal(series.demo, false);
    assert.equal(series.available, true);
    assert.equal(series.homeAbbr, "CLE");
    assert.equal(series.awayAbbr, "CHW");
    assert.equal(series.points.length, 3);
    assert.equal(series.points[0]?.homeWinPct, 0.55);
    assert.equal(series.points[0]?.playText, "Kwan grounds out.");
    assert.equal(series.points[1]?.playText, "Pham homered to left center.");
    assert.equal(series.points[2]?.homeWinPct, 0.88);
    assert.equal(series.evidenceLabel, "Evidence (ESPN WP series)");
    assert.match(series.rgFootnote ?? "", /1-800-GAMBLER/);
    assert.doesNotMatch(JSON.stringify(series), BETTING);
    assert.equal("odds" in series, false);
  });

  it("marks the largest published WP swings as tipping points with PBP labels", () => {
    const series = parseWinProbability(MLB_SUMMARY, { league: "mlb", gameId: "401816960" });
    assert.ok(series.tippingPoints.length >= 1);
    assert.equal(series.tippingPoints[0]?.playId, "p3");
    assert.equal(series.tippingPoints[0]?.playText, "Halpin homered to right center.");
    assert.ok(Math.abs(series.tippingPoints[0]?.swing ?? 0) > 0.4);
  });

  it("joins football drive plays by playId", () => {
    const series = parseWinProbability(NFL_SUMMARY, { league: "nfl", gameId: "401872925" });
    assert.equal(series.available, true);
    assert.equal(series.points.length, 2);
    assert.equal(series.homeAbbr, "CIN");
    assert.match(series.points[1]?.playText ?? "", /Mayfield sacked/);
    assert.equal(series.points[1]?.clock, "8:12");
  });

  it("skips invalid percentages and stays empty when nothing published is usable", () => {
    const series = parseWinProbability(
      {
        winprobability: [
          { playId: "x", homeWinPercentage: 61 },
          { playId: "y", homeWinPercentage: "n/a" },
        ],
      },
      { league: "cfb", gameId: "1" }
    );
    assertHonestEmpty(series);
  });

  it("does not treat predictor or odds as a win-probability series", () => {
    const series = parseWinProbability(
      {
        odds: { details: "-3.5" },
        pickcenter: [{ spread: -7 }],
        predictor: { homeTeam: { gameProjection: 28 } },
      },
      { league: "cfb", gameId: "401856682" }
    );
    assertHonestEmpty(series);
  });
});

describe("loadWinProbSeries", () => {
  it("does not fetch or invent a series when league or gameId is missing", async () => {
    let calls = 0;
    const series = await loadWinProbSeries({
      league: null,
      gameId: "401816960",
      getSummary: async () => {
        calls += 1;
        return MLB_SUMMARY;
      },
    });
    assert.equal(calls, 0);
    assertHonestEmpty(series);
  });

  it("does not fetch sample or non-digit game ids", async () => {
    let calls = 0;
    const series = await loadWinProbSeries({
      league: "cfb",
      gameId: "sample-event",
      getSummary: async () => {
        calls += 1;
        return MLB_SUMMARY;
      },
    });
    assert.equal(calls, 0);
    assertHonestEmpty(series);
  });

  it("returns the honest empty headline when ESPN fetch fails", async () => {
    const series = await loadWinProbSeries({
      league: "mlb",
      gameId: "401816960",
      getSummary: async () => {
        throw new Error("ESPN 500");
      },
    });
    assertHonestEmpty(series);
  });

  it("parses a fetched ESPN summary for a digit gameId", async () => {
    const series = await loadWinProbSeries({
      league: "mlb",
      gameId: "401816960",
      getSummary: async (path, league) => {
        assert.equal(path, "/summary?event=401816960");
        assert.equal(league, "mlb");
        return MLB_SUMMARY;
      },
    });
    assert.equal(series.available, true);
    assert.equal(series.points.length, 3);
  });
});

describe("attachResearchGraphs", () => {
  it("attaches an ESPN WP series to an X-Ray with league+gameId and not to Deep Lore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harmon-xray-graph-"));
    await writeFile(
      join(dir, "postgame-xray-cle.json"),
      JSON.stringify({
        kind: "postgame-xray",
        title: "Guardians X-Ray",
        publishedAt: "2026-09-16T04:00:00Z",
        league: "mlb",
        gameId: "401816960",
        evidence: ["Final published as CHW 3, CLE 5."],
        inference: ["Tipping swing inferred from the ESPN play list."],
      }),
      "utf8"
    );
    await writeFile(
      join(dir, "deep-lore-note.json"),
      JSON.stringify({
        kind: "deep-lore",
        title: "Pace note",
        publishedAt: "2026-09-16T05:00:00Z",
        evidence: ["A published cell."],
        inference: [],
      }),
      "utf8"
    );
    const feed = await loadResearchFeed({ dirs: [dir] });
    const xray = feed.xrays[0];
    assert.ok(xray);
    const graphs = await attachResearchGraphs({
      feed,
      selected: xray,
      getSummary: async () => MLB_SUMMARY,
    });
    assert.equal(graphs.xrayGraph?.available, true);
    assert.equal(graphs.xrayGraph?.points.length, 3);
    assert.equal(graphs.featuredXrayGraph, null);
    assert.doesNotMatch(JSON.stringify(xray), /homeWinPct|winprobability/i);

    const lore = await attachResearchGraphs({
      feed,
      selected: feed.latestDeepLore,
      getSummary: async () => MLB_SUMMARY,
    });
    assert.equal(lore.xrayGraph, null);

    const listed = await attachResearchGraphs({
      feed,
      selected: null,
      getSummary: async () => MLB_SUMMARY,
    });
    assert.equal(listed.featuredXrayGraph?.available, true);
    assert.equal(listed.xrayGraph, null);
  });

  it("keeps the featured strip honest when the latest X-Ray has no ESPN game id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harmon-xray-empty-"));
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "postgame-xray-local.json"),
      JSON.stringify({
        kind: "postgame-xray",
        title: "No id X-Ray",
        publishedAt: "2026-09-16T04:00:00Z",
        evidence: ["Final published as 14-7."],
        inference: [],
      }),
      "utf8"
    );
    const feed = await loadResearchFeed({ dirs: [dir] });
    let calls = 0;
    const graphs = await attachResearchGraphs({
      feed,
      selected: feed.xrays[0],
      getSummary: async () => {
        calls += 1;
        return MLB_SUMMARY;
      },
    });
    assert.equal(calls, 0);
    assert.equal(graphs.xrayGraph?.available, false);
    assert.equal(graphs.xrayGraph?.honesty.headline, "WIN PROBABILITY NOT ON THIS FEED");
  });
});
