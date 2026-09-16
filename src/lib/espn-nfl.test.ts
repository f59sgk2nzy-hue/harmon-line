import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardHref, gameHref, sportBoardHref, sportRankingsHref } from "./board-url";
import {
  conferenceLabel,
  coverageFor,
  nflConferenceForTeam,
  scoreboardGroups,
} from "./conferences";
import { assembleRankingsPage, pollTabsFor } from "./espn-rankings";
import { parseTeamProfile, teamHref } from "./espn-team";
import {
  espnScoreboardPath,
  parseCalendarWeeks,
  parseRegularSeasonWeeks,
  parseSeasonType,
  weekForEspnDate,
} from "./espn-weeks";
import { teamLogoUrl } from "./espn-path";
import { favoriteKey } from "./leagues";

const NFL_CALENDAR = {
  leagues: [
    {
      calendar: [
        {
          label: "Preseason",
          value: "1",
          entries: [
            {
              label: "Hall of Fame Weekend",
              alternateLabel: "HOF",
              detail: "Aug 6-12",
              value: "1",
              startDate: "2026-08-06T07:00Z",
              endDate: "2026-08-13T06:59Z",
            },
            {
              label: "Preseason Week 2",
              detail: "Aug 20-26",
              value: "3",
              startDate: "2026-08-20T07:00Z",
              endDate: "2026-08-27T06:59Z",
            },
          ],
        },
        {
          label: "Regular Season",
          value: "2",
          entries: [
            {
              label: "Week 1",
              detail: "Sep 6-15",
              value: "1",
              startDate: "2026-09-06T07:00Z",
              endDate: "2026-09-16T06:59Z",
            },
            {
              label: "Week 2",
              detail: "Sep 16-22",
              value: "2",
              startDate: "2026-09-16T07:00Z",
              endDate: "2026-09-23T06:59Z",
            },
          ],
        },
        {
          label: "Postseason",
          value: "3",
          entries: [
            {
              label: "Wild Card",
              detail: "Jan 13-19",
              value: "1",
              startDate: "2027-01-13T08:00Z",
              endDate: "2027-01-20T07:59Z",
            },
            {
              label: "Super Bowl",
              detail: "Feb 10-15",
              value: "5",
              startDate: "2027-02-10T08:00Z",
              endDate: "2027-02-16T07:59Z",
            },
          ],
        },
        {
          label: "Off Season",
          value: "4",
          entries: [],
        },
      ],
    },
  ],
};

describe("scoreboardGroups NFL", () => {
  it("does not send college D1/D2/NAIA groups on the NFL board", () => {
    assert.deepEqual(scoreboardGroups("nfl", "d1"), []);
    assert.deepEqual(scoreboardGroups("nfl", "d2", "fbs"), []);
    assert.deepEqual(scoreboardGroups("nfl", "naia"), []);
    assert.deepEqual(scoreboardGroups("cfb", "d1", "all"), ["80", "81"]);
  });
});

describe("NFL AFC/NFC from ESPN standings ids", () => {
  it("maps ESPN team ids onto AFC 8 and NFC 7 without inventing conferences", () => {
    assert.deepEqual(nflConferenceForTeam("2"), {
      id: "8",
      name: "AFC",
      abbreviation: "AFC",
    });
    assert.deepEqual(nflConferenceForTeam("6"), {
      id: "7",
      name: "NFC",
      abbreviation: "NFC",
    });
    assert.equal(nflConferenceForTeam("999"), null);
    assert.equal(conferenceLabel("8", "nfl"), "AFC");
    assert.equal(conferenceLabel("7", "nfl"), "NFC");
    assert.equal(conferenceLabel("8", "cfb"), "SEC");
  });
});

describe("NFL coverage copy", () => {
  it("names the 32-team ESPN board and stays honest on an empty week", () => {
    const note = coverageFor("d1", "nfl", { gameCount: 0 });
    assert.match(note.headline, /nfl/i);
    assert.match(note.detail, /32/);
    assert.match(note.detail, /never invent/i);
    assert.match(note.detail, /no college/i);
    assert.doesNotMatch(note.detail, /group 50|Division I FBS/i);

    const cfb = coverageFor("d1");
    assert.match(cfb.headline, /Division I/);
    assert.doesNotMatch(cfb.detail, /32-team/);
  });
});

describe("NFL week calendar", () => {
  it("surfaces pre/regular/post only when ESPN calendar returned entries — never invents off-season weeks", () => {
    const weeks = parseCalendarWeeks(NFL_CALENDAR);
    assert.deepEqual(
      weeks.map((week) => `${week.seasonType}:${week.number}:${week.label}`),
      [
        "1:1:Hall of Fame Weekend",
        "1:3:Preseason Week 2",
        "2:1:Week 1",
        "2:2:Week 2",
        "3:1:Wild Card",
        "3:5:Super Bowl",
      ]
    );
    assert.equal(
      weeks.some((week) => week.label === "Off Season" || week.seasonType === 4),
      false
    );
  });

  it("keeps CFB regular-season parsing from inventing bowl weeks", () => {
    const weeks = parseRegularSeasonWeeks(NFL_CALENDAR);
    assert.deepEqual(
      weeks.map((week) => `${week.seasonType}:${week.number}`),
      ["2:1", "2:2"]
    );
  });

  it("maps Eastern dates onto the ESPN window of the matching season type", () => {
    const weeks = parseCalendarWeeks(NFL_CALENDAR);
    assert.equal(weekForEspnDate("20260810", weeks)?.label, "Hall of Fame Weekend");
    assert.equal(weekForEspnDate("20260916", weeks)?.number, 2);
    assert.equal(weekForEspnDate("20260916", weeks)?.seasonType, 2);
    assert.equal(weekForEspnDate("20270115", weeks)?.label, "Wild Card");
    assert.equal(weekForEspnDate("20260701", weeks), null);
  });
});

describe("parseSeasonType NFL vs CFB", () => {
  it("honors ESPN pre/regular/post for NFL and still pins CFB to regular season", () => {
    assert.equal(parseSeasonType("1", "nfl"), 1);
    assert.equal(parseSeasonType("3", "nfl"), 3);
    assert.equal(parseSeasonType("2", "nfl"), 2);
    assert.equal(parseSeasonType("4", "nfl"), 2);
    assert.equal(parseSeasonType(null, "nfl"), 2);
    assert.equal(parseSeasonType("3", "cfb"), 2);
    assert.equal(parseSeasonType("1"), 2);
  });
});

describe("espnScoreboardPath NFL", () => {
  it("loads the NFL week slate without college groups", () => {
    assert.equal(
      espnScoreboardPath({
        date: "20260916",
        week: 2,
        year: 2026,
        seasonType: 2,
        view: "week",
      }),
      "/scoreboard?week=2&seasontype=2&dates=2026&limit=300"
    );
    assert.equal(
      espnScoreboardPath({
        date: "20260820",
        week: 3,
        year: 2026,
        seasonType: 1,
        view: "week",
      }),
      "/scoreboard?week=3&seasontype=1&dates=2026&limit=300"
    );
  });

  it("asks ESPN for the current NFL week instead of inventing a week number", () => {
    assert.equal(
      espnScoreboardPath({
        date: "20260916",
        view: "week",
      }),
      "/scoreboard?limit=300"
    );
  });

  it("keeps CFB group 80 week URLs unchanged", () => {
    assert.equal(
      espnScoreboardPath({
        group: "80",
        date: "20260915",
        week: 3,
        year: 2026,
        view: "week",
      }),
      "/scoreboard?groups=80&week=3&seasontype=2&dates=2026&limit=300"
    );
  });
});

describe("NFL hrefs", () => {
  it("scopes board, game, and team URLs with league=nfl and week/seasontype", () => {
    assert.equal(sportBoardHref("nfl"), "/?league=nfl");
    assert.equal(sportRankingsHref("nfl"), "/rankings?league=nfl");
    assert.equal(gameHref("401872656", "nfl"), "/game/401872656?league=nfl");
    assert.equal(teamHref("2", "nfl"), "/team/2?league=nfl");
    assert.equal(
      boardHref({
        division: "d1",
        date: "20260916",
        week: 2,
        year: 2026,
        seasonType: 2,
        league: "nfl",
      }),
      "/?division=d1&date=20260916&week=2&year=2026&seasontype=2&league=nfl"
    );
    assert.equal(
      boardHref({
        division: "d1",
        date: "20260914",
        week: 3,
        year: 2026,
      }),
      "/?division=d1&date=20260914&week=3&year=2026"
    );
  });
});

describe("NFL logos", () => {
  it("uses the nfl/500 CDN namespace with abbreviations, not ncaa", () => {
    assert.equal(
      teamLogoUrl("6", "nfl", "DAL"),
      "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png"
    );
    assert.equal(
      teamLogoUrl("333", "cfb"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png"
    );
  });
});

describe("NFL rankings honesty", () => {
  it("exposes no poll tabs and does not invent an AP ballot", () => {
    assert.deepEqual(pollTabsFor("nfl"), []);
    const page = assembleRankingsPage({
      payload: { rankings: [{ id: "1", type: "ap", ranks: [{ current: 1, team: { id: "2" } }] }] },
      poll: "ap",
      league: "nfl",
    });
    assert.equal(page.demo, false);
    assert.equal(page.league, "nfl");
    assert.equal(page.polls.length, 0);
    assert.equal(page.selected, null);
    assert.match(page.coverage.detail, /not published|no rankings|404|does not publish/i);
    assert.doesNotMatch(page.coverage.detail, /sample|invent/i);
  });
});

describe("NFL team profile", () => {
  it("labels AFC/NFC from the ESPN team id and uses the NFL logo CDN", () => {
    const team = parseTeamProfile(
      {
        team: {
          id: "2",
          displayName: "Buffalo Bills",
          abbreviation: "BUF",
        },
      },
      "nfl"
    );
    assert.equal(team.subdivision, "AFC");
    assert.equal(team.conferenceName, "AFC");
    assert.equal(team.conferenceId, "8");
    assert.equal(team.logo, "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png");
  });
});

describe("favorites keys", () => {
  it("namespaces team ids by league so NFL 2 is not CFB 2", () => {
    assert.equal(favoriteKey("nfl", "2"), "nfl:2");
    assert.equal(favoriteKey("cfb", "2"), "cfb:2");
    assert.equal(favoriteKey("mbb", "150"), "mbb:150");
  });
});
