import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardHref, gameHref, sportBoardHref, sportRankingsHref, sportStandingsHref } from "./board-url";
import { conferenceLabel, coverageFor, scoreboardGroups } from "./conferences";
import { assembleRankingsPage, pollTabsFor } from "./espn-rankings";
import { parseTeamProfile, teamHref } from "./espn-team";
import { espnScoreboardPath } from "./espn-weeks";
import { periodLabel, periodSportFor, playPeriodLabel } from "./espn-parse";
import { teamLogoUrl } from "./espn-path";
import { favoriteKey } from "./leagues";

describe("scoreboardGroups NBA", () => {
  it("does not send college D1/D2/NAIA or MBB group 50 on the NBA board", () => {
    assert.deepEqual(scoreboardGroups("nba", "d1"), []);
    assert.deepEqual(scoreboardGroups("nba", "d2", "fbs"), []);
    assert.deepEqual(scoreboardGroups("nba", "naia"), []);
    assert.deepEqual(scoreboardGroups("mbb", "d1"), ["50"]);
    assert.deepEqual(scoreboardGroups("cfb", "d1", "all"), ["80", "81"]);
  });
});

describe("NBA coverage copy", () => {
  it("names the ESPN basketball/nba date board and stays honest on an empty night", () => {
    const note = coverageFor("d1", "nba", { gameCount: 0 });
    assert.match(note.headline, /nba/i);
    assert.match(note.detail, /basketball\/nba|nba/i);
    assert.match(note.detail, /dates=YYYYMMDD|date/i);
    assert.match(note.detail, /never invent/i);
    assert.match(note.detail, /no college|no rankings|404/i);
    assert.doesNotMatch(note.detail, /group 50|Division I FBS|32-team/i);
    assert.doesNotMatch(note.headline, /not shipped/i);

    const cfb = coverageFor("d1");
    assert.match(cfb.headline, /Division I/);
    assert.doesNotMatch(cfb.detail, /nba/i);
  });
});

describe("NBA period labels", () => {
  it("uses football-style quarters, not MBB halves", () => {
    assert.equal(periodSportFor("nba"), "football");
    assert.equal(periodSportFor("mbb"), "basketball");
    assert.equal(periodSportFor("cfb"), "football");
    assert.equal(periodLabel(0, periodSportFor("nba")), "Q1");
    assert.equal(periodLabel(3, periodSportFor("nba")), "Q4");
    assert.equal(periodLabel(4, periodSportFor("nba")), "OT");
    assert.equal(playPeriodLabel(1, periodSportFor("nba")), "Q1");
    assert.equal(playPeriodLabel(5, periodSportFor("nba")), "OT");
    assert.equal(periodLabel(0, periodSportFor("mbb")), "1H");
    assert.equal(periodLabel(1, periodSportFor("mbb")), "2H");
  });
});

describe("espnScoreboardPath NBA", () => {
  it("loads the NBA slate by Eastern date with no college groups or week chips", () => {
    assert.equal(
      espnScoreboardPath({
        date: "20260415",
        view: "date",
      }),
      "/scoreboard?dates=20260415&limit=300"
    );
    assert.equal(
      espnScoreboardPath({
        date: "20261021",
        view: "date",
        limit: 300,
      }),
      "/scoreboard?dates=20261021&limit=300"
    );
  });
});

describe("NBA hrefs", () => {
  it("scopes board, game, and team URLs with league=nba and date, not week", () => {
    assert.equal(sportBoardHref("nba"), "/?league=nba");
    assert.equal(sportRankingsHref("nba"), "/rankings?league=nba");
    assert.equal(sportStandingsHref("nba"), "/standings?league=nba");
    assert.equal(gameHref("401809937", "nba"), "/game/401809937?league=nba");
    assert.equal(teamHref("13", "nba"), "/team/13?league=nba");
    assert.equal(
      boardHref({
        division: "d1",
        date: "20260415",
        league: "nba",
      }),
      "/?division=d1&date=20260415&league=nba"
    );
    assert.doesNotMatch(
      boardHref({
        division: "d1",
        date: "20260415",
        week: 2,
        year: 2026,
        league: "nba",
      }),
      /week=/
    );
  });
});

describe("NBA logos", () => {
  it("uses the nba/500 CDN namespace with abbreviations, not ncaa", () => {
    assert.equal(
      teamLogoUrl("13", "nba", "LAL"),
      "https://a.espncdn.com/i/teamlogos/nba/500/lal.png"
    );
    assert.equal(
      teamLogoUrl("20", "nba", "PHI"),
      "https://a.espncdn.com/i/teamlogos/nba/500/phi.png"
    );
    assert.equal(
      teamLogoUrl("150", "mbb"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png"
    );
  });
});

describe("NBA rankings honesty", () => {
  it("exposes no poll tabs and does not invent an AP ballot", () => {
    assert.deepEqual(pollTabsFor("nba"), []);
    const page = assembleRankingsPage({
      payload: { rankings: [{ id: "1", type: "ap", ranks: [{ current: 1, team: { id: "13" } }] }] },
      poll: "ap",
      league: "nba",
    });
    assert.equal(page.demo, false);
    assert.equal(page.league, "nba");
    assert.equal(page.polls.length, 0);
    assert.equal(page.selected, null);
    assert.match(page.coverage.detail, /not published|no rankings|404|does not publish/i);
    assert.match(page.coverage.headline, /nba|this league|no espn rankings/i);
    assert.doesNotMatch(page.coverage.detail, /sample|invent/i);
  });
});

describe("NBA team profile", () => {
  it("labels NBA from the league and uses the NBA logo CDN", () => {
    const team = parseTeamProfile(
      {
        team: {
          id: "13",
          displayName: "Los Angeles Lakers",
          abbreviation: "LAL",
        },
      },
      "nba"
    );
    assert.equal(team.subdivision, "NBA");
    assert.equal(team.logo, "https://a.espncdn.com/i/teamlogos/nba/500/lal.png");
  });
});

describe("NBA conference names", () => {
  it("does not reuse CFB conference ids — unknown ids stay labeled, not SEC", () => {
    assert.equal(conferenceLabel("8", "cfb"), "SEC");
    assert.equal(conferenceLabel("8", "nba"), "Conference 8");
  });
});

describe("favorites keys", () => {
  it("namespaces NBA team ids so Lakers 13 is not CFB 13", () => {
    assert.equal(favoriteKey("nba", "13"), "nba:13");
    assert.equal(favoriteKey("cfb", "13"), "cfb:13");
    assert.equal(favoriteKey("nfl", "13"), "nfl:13");
  });
});
