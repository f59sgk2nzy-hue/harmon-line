import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardHref, gameHref } from "./board-url";
import { conferenceLabel, coverageFor, scoreboardGroups } from "./conferences";
import { parsePlayerBoxscore } from "./espn-gamecast";
import { parseLeaders, parsePlays, parseScoringPlays } from "./espn-plays";
import { periodLabel, playPeriodLabel } from "./espn-parse";
import {
  POLL_TABS,
  assembleRankingsPage,
  parsePollParam,
  pollTabsFor,
} from "./espn-rankings";
import { parseTeamProfile, teamHref } from "./espn-team";

describe("scoreboardGroups", () => {
  it("keeps CFB D1 as ESPN groups 80 and 81", () => {
    assert.deepEqual(scoreboardGroups("cfb", "d1", "all"), ["80", "81"]);
    assert.deepEqual(scoreboardGroups("cfb", "d1", "fbs"), ["80"]);
    assert.deepEqual(scoreboardGroups("cfb", "d2"), ["57"]);
  });

  it("loads MBB D1 from ESPN group 50 only — D2/NAIA basketball stay deferred", () => {
    assert.deepEqual(scoreboardGroups("mbb", "d1"), ["50"]);
    assert.deepEqual(scoreboardGroups("mbb", "d2"), ["50"]);
    assert.deepEqual(scoreboardGroups("mbb", "naia", "fbs"), ["50"]);
  });
});

describe("MBB conference names", () => {
  it("does not reuse CFB conference ids — 4 is Big East in MBB, Big 12 in CFB", () => {
    assert.equal(conferenceLabel("4"), "Big 12");
    assert.equal(conferenceLabel("4", "cfb"), "Big 12");
    assert.equal(conferenceLabel("4", "mbb"), "Big East");
    assert.equal(conferenceLabel("7", "mbb"), "Big Ten");
    assert.equal(conferenceLabel("2", "mbb"), "ACC");
  });
});

describe("MBB coverage copy", () => {
  it("names ESPN group 50 and stays honest on a thin or truncated slate", () => {
    const empty = coverageFor("d1", "mbb", { gameCount: 0, limit: 400 });
    assert.match(empty.headline, /basketball/i);
    assert.match(empty.detail, /group 50/i);
    assert.match(empty.detail, /never invent/i);
    assert.match(empty.detail, /september|out of season|empty/i);

    const truncated = coverageFor("d1", "mbb", { gameCount: 400, limit: 400 });
    assert.match(truncated.detail, /truncat/i);

    const cfb = coverageFor("d1");
    assert.match(cfb.headline, /Division I/);
    assert.doesNotMatch(cfb.detail, /group 50/);
  });
});

describe("basketball period labels", () => {
  it("keeps football quarters as the default", () => {
    assert.equal(periodLabel(0), "Q1");
    assert.equal(periodLabel(3), "Q4");
    assert.equal(periodLabel(4), "OT");
    assert.equal(playPeriodLabel(1), "Q1");
    assert.equal(playPeriodLabel(5), "OT");
  });

  it("labels MBB halves instead of inventing football quarters", () => {
    assert.equal(periodLabel(0, "basketball"), "1H");
    assert.equal(periodLabel(1, "basketball"), "2H");
    assert.equal(periodLabel(2, "basketball"), "OT");
    assert.equal(periodLabel(3, "basketball"), "2OT");
    assert.equal(playPeriodLabel(1, "basketball"), "1H");
    assert.equal(playPeriodLabel(2, "basketball"), "2H");
    assert.equal(playPeriodLabel(3, "basketball"), "OT");
    assert.equal(playPeriodLabel(null, "basketball"), "");
  });
});

describe("parsePlays", () => {
  it("reads a flat ESPN basketball PBP list without wrapping football drives", () => {
    const plays = parsePlays([
      {
        id: "1",
        text: "Start game",
        scoringPlay: false,
        homeScore: 0,
        awayScore: 0,
        period: { number: 1, displayValue: "1st Half" },
        clock: { displayValue: "20:00" },
        type: { text: "Jumpball" },
      },
      {
        id: "2",
        text: "Silas Demary Jr. made Jumper.",
        scoringPlay: true,
        homeScore: 2,
        awayScore: 0,
        period: { number: 2 },
        clock: { displayValue: "18:34" },
        team: { id: "41" },
      },
    ]);
    assert.equal(plays.length, 2);
    assert.equal(plays[0]?.text, "Start game");
    assert.equal(plays[0]?.period, 1);
    assert.equal(plays[0]?.clock, "20:00");
    assert.equal(plays[1]?.scoringPlay, true);
    assert.equal(plays[1]?.homeScore, 2);
    assert.equal(plays[1]?.teamId, "41");
  });

  it("does not invent plays when ESPN omitted the feed", () => {
    assert.deepEqual(parsePlays(undefined), []);
    assert.deepEqual(parsePlays([]), []);
  });
});

describe("parseScoringPlays", () => {
  it("uses published scoringPlays, or scoring flags on the PBP list, never invented buckets", () => {
    const fromNode = parseScoringPlays({
      scoringPlays: [
        {
          id: "s1",
          text: "Made three",
          period: { number: 1 },
          clock: { displayValue: "4:12" },
          homeScore: 3,
          awayScore: 0,
          team: { id: "150", displayName: "Duke" },
          type: { text: "Three Point Jumper" },
        },
      ],
    });
    assert.equal(fromNode.length, 1);
    assert.equal(fromNode[0]?.homeScore, 3);

    const fromPlays = parseScoringPlays({
      plays: [
        { id: "p1", text: "Miss", scoringPlay: false, homeScore: 0, awayScore: 0 },
        {
          id: "p2",
          text: "Made jumper",
          scoringPlay: true,
          homeScore: 2,
          awayScore: 0,
          period: { number: 2 },
          clock: { displayValue: "1:00" },
          team: { id: "41", displayName: "UConn" },
        },
      ],
    });
    assert.equal(fromPlays.length, 1);
    assert.equal(fromPlays[0]?.text, "Made jumper");
    assert.equal(fromPlays[0]?.teamName, "UConn");
  });
});

describe("parseLeaders", () => {
  it("reads football-style flat categories", () => {
    const lines = parseLeaders([
      {
        displayName: "Passing Yards",
        leaders: [
          {
            displayValue: "312 YDS",
            athlete: { displayName: "Walker Eget" },
            team: { id: "150" },
          },
        ],
      },
    ]);
    assert.equal(lines[0]?.category, "Passing Yards");
    assert.equal(lines[0]?.name, "Walker Eget");
    assert.equal(lines[0]?.teamId, "150");
  });

  it("flattens basketball per-team nested leaders", () => {
    const lines = parseLeaders([
      {
        team: { id: "41", abbreviation: "CONN" },
        leaders: [
          {
            name: "points",
            displayName: "Points",
            leaders: [
              {
                displayValue: "21",
                athlete: { displayName: "Tarris Reed Jr." },
              },
            ],
          },
        ],
      },
    ]);
    assert.equal(lines[0]?.category, "Points");
    assert.equal(lines[0]?.name, "Tarris Reed Jr.");
    assert.equal(lines[0]?.displayValue, "21");
    assert.equal(lines[0]?.teamId, "41");
  });
});

describe("MBB player box without a category name", () => {
  it("still surfaces player cats when ESPN omitted name/text", () => {
    const box = parsePlayerBoxscore({
      players: [
        {
          team: { id: "41", displayName: "UConn Huskies", abbreviation: "CONN" },
          statistics: [
            {
              labels: ["MIN", "PTS", "FG"],
              names: ["Starters"],
              athletes: [
                {
                  athlete: { id: "1", displayName: "Tarris Reed Jr.", jersey: "5" },
                  stats: ["32", "21", "8-10"],
                },
              ],
              totals: ["200", "86", "29-59"],
            },
          ],
        },
      ],
    });
    assert.equal(box.available, true);
    assert.equal(box.teams[0]?.categories[0]?.name, "Starters");
    assert.equal(box.teams[0]?.categories[0]?.athletes[0]?.name, "Tarris Reed Jr.");
    assert.deepEqual(box.teams[0]?.categories[0]?.labels, ["MIN", "PTS", "FG"]);
  });
});

describe("MBB rankings tabs", () => {
  it("exposes AP and Coaches for MBB, not FCS/D2/D3 football polls", () => {
    assert.deepEqual(
      pollTabsFor("mbb").map((tab) => tab.id),
      ["ap", "coaches"]
    );
    assert.deepEqual(
      pollTabsFor("cfb").map((tab) => tab.id),
      POLL_TABS.map((tab) => tab.id)
    );
    assert.equal(parsePollParam("fcs", "mbb"), "ap");
    assert.equal(parsePollParam("coaches", "mbb"), "coaches");
  });

  it("assembles MBB polls from ESPN JSON without inventing points or extra football tabs", () => {
    const page = assembleRankingsPage({
      payload: {
        requestedSeason: { year: 2026, week: { number: 20 } },
        rankings: [
          {
            id: "1",
            name: "AP Top 25",
            shortName: "AP Poll",
            type: "ap",
            headline: "2026 NCAA Men's Basketball Rankings - AP Poll",
            occurrence: { number: 18, displayValue: "Week 18" },
            ranks: [
              {
                current: 1,
                previous: 1,
                points: 1540,
                trend: "-",
                recordSummary: "31-3",
                team: { id: "150", nickname: "Duke", abbreviation: "DUKE" },
              },
              {
                current: 2,
                previous: 4,
                recordSummary: "30-4",
                team: { id: "41", nickname: "UConn", abbreviation: "CONN" },
              },
            ],
          },
          {
            id: "2",
            name: "Coaches Poll",
            shortName: "Coaches Poll",
            type: "usa",
            ranks: [],
          },
        ],
      },
      poll: "ap",
      league: "mbb",
      now: new Date("2026-09-16T16:00:00Z"),
    });
    assert.equal(page.demo, false);
    assert.equal(page.league, "mbb");
    assert.deepEqual(
      page.polls.map((poll) => poll.id),
      ["ap", "coaches"]
    );
    assert.equal(page.selected?.ranks[0]?.team.id, "150");
    assert.equal(page.selected?.ranks[0]?.points, 1540);
    assert.equal(page.selected?.ranks[1]?.points, null);
    assert.equal(
      page.selected?.ranks[0]?.team.logo,
      "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png"
    );
    assert.match(page.coverage.detail, /basketball|poll/i);
    assert.doesNotMatch(page.coverage.detail, /sample|invent/i);
    assert.equal(page.polls.find((poll) => poll.id === "coaches")?.ranks.length, 0);
  });
});

describe("MBB team profile", () => {
  it("stays D1 when ESPN conference ids collide with CFB (4 is Big East, not Big 12)", () => {
    const team = parseTeamProfile(
      {
        team: {
          id: "41",
          displayName: "UConn Huskies",
          abbreviation: "CONN",
          conferenceId: "4",
          groups: { id: "4" },
        },
      },
      "mbb"
    );
    assert.equal(team.subdivision, "D1");
    assert.equal(team.conferenceName, "Big East");
    assert.equal(
      team.logo,
      "https://a.espncdn.com/i/teamlogos/ncaa/500/41.png"
    );
  });
});

describe("league-scoped hrefs", () => {
  it("omits league on CFB and appends league=mbb on MBB surfaces", () => {
    assert.equal(gameHref("401812788"), "/game/401812788");
    assert.equal(gameHref("401812788", "cfb"), "/game/401812788");
    assert.equal(gameHref("401812788", "mbb"), "/game/401812788?league=mbb");
    assert.equal(teamHref("150"), "/team/150");
    assert.equal(teamHref("150", "mbb"), "/team/150?league=mbb");
    assert.equal(
      boardHref({ division: "d1", date: "20251115", league: "mbb" }),
      "/?division=d1&date=20251115&league=mbb"
    );
  });
});
