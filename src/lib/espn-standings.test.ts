import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sportStandingsHref } from "./board-url";
import { espnRequestUrl, espnV2RequestUrl, DEFAULT_ESPN_WEB_ORIGIN } from "./espn-path";
import {
  assembleStandingsPage,
  defaultStandingsGroup,
  parseConferenceParam,
  parseStandingsGroups,
  standingsPath,
} from "./espn-standings";
import { favoriteKey } from "./leagues";

const ALABAMA_ENTRY = {
  team: {
    id: "333",
    location: "Alabama",
    name: "Crimson Tide",
    displayName: "Alabama Crimson Tide",
    abbreviation: "ALA",
    logos: [{ href: "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png" }],
  },
  stats: [
    {
      type: "total",
      name: "overall",
      abbreviation: "overall",
      shortDisplayName: "OVER",
      displayValue: "2-0",
    },
    {
      type: "vsconf",
      name: "vs. Conf.",
      abbreviation: "CONF",
      shortDisplayName: "CONF",
      displayValue: "1-0",
    },
    {
      type: "pointsfor",
      name: "pointsFor",
      abbreviation: "PF",
      shortDisplayName: "PF",
      displayValue: "93",
    },
    {
      type: "pointsagainst",
      name: "pointsAgainst",
      abbreviation: "PA",
      shortDisplayName: "PA",
      displayValue: "27",
    },
    {
      type: "pointdifferential",
      name: "pointDifferential",
      abbreviation: "DIFF",
      shortDisplayName: "DIFF",
      displayValue: "+66",
    },
    {
      type: "streak",
      name: "streak",
      abbreviation: "STRK",
      shortDisplayName: "STRK",
      displayValue: "W2",
    },
    {
      type: "wins",
      name: "wins",
      abbreviation: "W",
      displayValue: "2",
    },
    {
      type: "homerecord_pointsfor",
      name: "pointsFor",
      abbreviation: "PF",
      shortDisplayName: "PF",
      displayValue: "48",
    },
  ],
};

const CFB_FBS_PAYLOAD = {
  id: "80",
  name: "FBS",
  shortName: "FBS",
  isConference: false,
  season: { year: 2026, displayName: "2026" },
  children: [
    {
      id: "8",
      name: "Southeastern Conference",
      abbreviation: "SEC",
      shortName: "SEC",
      isConference: true,
      standings: { entries: [ALABAMA_ENTRY] },
    },
    {
      id: "5",
      name: "Big Ten Conference",
      abbreviation: "B1G",
      shortName: "Big Ten",
      isConference: true,
      standings: {
        entries: [
          {
            team: {
              id: "194",
              displayName: "Ohio State Buckeyes",
              abbreviation: "OSU",
            },
            stats: [
              {
                type: "total",
                name: "overall",
                displayValue: "2-0",
              },
              {
                type: "vsconf",
                name: "vs. Conf.",
                abbreviation: "CONF",
                displayValue: "1-0",
              },
            ],
          },
        ],
      },
    },
    {
      id: "37",
      name: "Sun Belt Conference",
      abbreviation: "SBC",
      shortName: "Sun Belt",
      isConference: true,
      standings: { entries: [] },
    },
  ],
};

const NFL_PAYLOAD = {
  id: "9",
  name: "National Football League",
  abbreviation: "NFL",
  season: { year: 2026 },
  children: [
    {
      id: "8",
      name: "American Football Conference",
      abbreviation: "AFC",
      isConference: true,
      standings: {
        entries: [
          {
            team: {
              id: "33",
              displayName: "Baltimore Ravens",
              abbreviation: "BAL",
              logos: [{ href: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png" }],
            },
            stats: [
              { type: "total", name: "overall", displayValue: "1-0" },
              { type: "vsconf", name: "vs. Conf.", displayValue: "1-0" },
              { type: "pointsfor", name: "pointsFor", abbreviation: "PF", displayValue: "41" },
              { type: "pointsagainst", name: "pointsAgainst", abbreviation: "PA", displayValue: "23" },
            ],
          },
        ],
      },
    },
    {
      id: "7",
      name: "National Football Conference",
      abbreviation: "NFC",
      isConference: true,
      standings: {
        entries: [
          {
            team: {
              id: "16",
              displayName: "Minnesota Vikings",
              abbreviation: "MIN",
            },
            stats: [
              { type: "total", name: "overall", displayValue: "1-0" },
              { type: "vsconf", name: "vs. Conf.", displayValue: "1-0" },
            ],
          },
        ],
      },
    },
  ],
};

const MLB_PAYLOAD = {
  id: "9",
  name: "Major League Baseball",
  abbreviation: "MLB",
  season: { year: 2026 },
  children: [
    {
      id: "7",
      name: "American League",
      abbreviation: "AL",
      standings: {
        entries: [
          {
            team: {
              id: "30",
              displayName: "Tampa Bay Rays",
              abbreviation: "TB",
            },
            stats: [
              { type: "total", name: "overall", abbreviation: "Total", displayValue: "92-59" },
              { type: "pointsfor", name: "pointsFor", abbreviation: "RS", displayValue: "688" },
              { type: "pointsagainst", name: "pointsAgainst", abbreviation: "RA", displayValue: "617" },
            ],
          },
        ],
      },
    },
    {
      id: "8",
      name: "National League",
      abbreviation: "NL",
      standings: {
        entries: [
          {
            team: {
              id: "19",
              displayName: "Los Angeles Dodgers",
              abbreviation: "LAD",
            },
            stats: [{ type: "total", name: "overall", displayValue: "90-61" }],
          },
        ],
      },
    },
  ],
};

describe("standingsPath / defaultStandingsGroup", () => {
  it("asks ESPN CFB FBS group 80 and MBB D1 group 50, and league roots for NFL/NBA/MLB", () => {
    assert.equal(defaultStandingsGroup("cfb"), "80");
    assert.equal(defaultStandingsGroup("mbb"), "50");
    assert.equal(defaultStandingsGroup("nfl"), null);
    assert.equal(defaultStandingsGroup("nba"), null);
    assert.equal(defaultStandingsGroup("mlb"), null);
    assert.equal(standingsPath("cfb"), "/standings?group=80");
    assert.equal(standingsPath("mbb"), "/standings?group=50");
    assert.equal(standingsPath("nfl"), "/standings");
    assert.equal(standingsPath("mlb"), "/standings");
    assert.equal(standingsPath("nba"), "/standings");
  });
});

describe("espnV2RequestUrl", () => {
  it("builds public /apis/v2 standings URLs, not site/v2 scoreboard paths", () => {
    assert.equal(
      espnV2RequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "cfb", "/standings?group=80"),
      "https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings?group=80"
    );
    assert.equal(
      espnV2RequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "nfl", "/standings"),
      "https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings"
    );
    assert.equal(
      espnV2RequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "mlb", "/standings"),
      "https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings"
    );
    assert.notEqual(
      espnRequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "cfb", "/standings"),
      espnV2RequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "cfb", "/standings")
    );
  });
});

describe("parseStandingsGroups", () => {
  it("turns CFB FBS conference children into tables and skips empty Sun Belt rows", () => {
    const parsed = parseStandingsGroups(CFB_FBS_PAYLOAD, "cfb");
    assert.deepEqual(
      parsed.conferences.map((row) => row.id),
      ["8", "5", "37"]
    );
    assert.equal(parsed.conferences[0]?.abbreviation, "SEC");
    assert.deepEqual(
      parsed.groups.map((row) => row.id),
      ["8", "5"]
    );
    const sec = parsed.groups[0];
    assert.equal(sec?.name, "Southeastern Conference");
    assert.equal(sec?.entries.length, 1);
    assert.equal(sec?.entries[0]?.team.id, "333");
    assert.equal(sec?.entries[0]?.team.name, "Alabama Crimson Tide");
    assert.equal(sec?.entries[0]?.stats.total, "2-0");
    assert.equal(sec?.entries[0]?.stats.vsconf, "1-0");
    assert.equal(sec?.entries[0]?.stats.pointsfor, "93");
    assert.equal(sec?.entries[0]?.stats.pointsagainst, "27");
  });

  it("displays only published primary stats and never invents W-L from wins/losses", () => {
    const parsed = parseStandingsGroups(CFB_FBS_PAYLOAD, "cfb");
    const sec = parsed.groups[0];
    const keys = sec?.columns.map((col) => col.key) ?? [];
    assert.deepEqual(keys, ["total", "vsconf", "pointsfor", "pointsagainst", "pointdifferential", "streak"]);
    assert.equal(sec?.columns[0]?.label, "W-L");
    assert.equal(sec?.entries[0]?.stats.wins, undefined);
    assert.equal(sec?.entries[0]?.stats.pointsfor, "93");
    assert.notEqual(sec?.entries[0]?.stats.pointsfor, "48");

    const winsOnly = parseStandingsGroups(
      {
        id: "8",
        name: "SEC",
        standings: {
          entries: [
            {
              team: { id: "333", displayName: "Alabama Crimson Tide", abbreviation: "ALA" },
              stats: [
                { type: "wins", name: "wins", displayValue: "2" },
                { type: "losses", name: "losses", displayValue: "0" },
              ],
            },
          ],
        },
      },
      "cfb"
    );
    assert.equal(winsOnly.groups[0]?.entries[0]?.stats.total, undefined);
    assert.deepEqual(winsOnly.groups[0]?.columns, []);
  });

  it("drops rows without an ESPN team id so /team links are never guessed", () => {
    const parsed = parseStandingsGroups(
      {
        id: "8",
        name: "SEC",
        standings: {
          entries: [
            {
              team: { displayName: "Ghost Team", abbreviation: "GST" },
              stats: [{ type: "total", name: "overall", displayValue: "1-0" }],
            },
            ALABAMA_ENTRY,
          ],
        },
      },
      "cfb"
    );
    assert.deepEqual(
      parsed.groups[0]?.entries.map((row) => row.team.id),
      ["333"]
    );
  });

  it("parses NFL AFC/NFC and MLB league children without inventing divisions", () => {
    const nfl = parseStandingsGroups(NFL_PAYLOAD, "nfl");
    assert.deepEqual(
      nfl.conferences.map((row) => row.abbreviation),
      ["AFC", "NFC"]
    );
    assert.equal(nfl.groups[0]?.entries[0]?.team.id, "33");
    assert.equal(nfl.groups[0]?.entries[0]?.stats.total, "1-0");
    assert.equal(nfl.groups[0]?.entries[0]?.stats.pointsfor, "41");

    const mlb = parseStandingsGroups(MLB_PAYLOAD, "mlb");
    assert.equal(mlb.groups[0]?.columns.find((col) => col.key === "pointsfor")?.label, "RS");
    assert.equal(mlb.groups[0]?.entries[0]?.stats.pointsfor, "688");
    assert.equal(mlb.groups[1]?.entries[0]?.team.id, "19");
  });
});

describe("assembleStandingsPage", () => {
  it("keeps demo false and filters to a published conference without inventing rows", () => {
    const page = assembleStandingsPage({
      payload: CFB_FBS_PAYLOAD,
      league: "cfb",
      conference: "8",
      now: new Date("2026-09-17T18:00:00Z"),
    });
    assert.equal(page.source, "espn");
    assert.equal(page.demo, false);
    assert.equal(page.league, "cfb");
    assert.equal(page.conference, "8");
    assert.equal(page.seasonYear, 2026);
    assert.equal(page.groupId, "80");
    assert.equal(page.groups.length, 2);
    assert.equal(page.groups[0]?.id, "8");
    assert.equal(page.groups[0]?.entries[0]?.team.id, "333");
    assert.match(page.coverage.detail, /never invent/i);
    assert.equal(favoriteKey("cfb", page.groups[0]!.entries[0]!.team.id), "cfb:333");
  });

  it("returns an honest empty board when ESPN published no entries", () => {
    const page = assembleStandingsPage({
      payload: { id: "80", name: "FBS", children: [] },
      league: "cfb",
    });
    assert.equal(page.demo, false);
    assert.equal(page.groups.length, 0);
    assert.match(page.coverage.headline, /standings/i);
    assert.match(page.coverage.detail, /not published|no rows|empty/i);
  });

  it("does not invent NFL/MLB rows when the payload has no children", () => {
    const nfl = assembleStandingsPage({ payload: {}, league: "nfl" });
    assert.equal(nfl.demo, false);
    assert.equal(nfl.groups.length, 0);
    assert.equal(nfl.league, "nfl");
  });
});

describe("parseConferenceParam / sportStandingsHref", () => {
  it("keeps CFB at /standings and scopes sibling leagues plus conference chips", () => {
    assert.equal(sportStandingsHref("cfb"), "/standings");
    assert.equal(sportStandingsHref("nfl"), "/standings?league=nfl");
    assert.equal(sportStandingsHref("cfb", "8"), "/standings?conference=8");
    assert.equal(sportStandingsHref("mlb", "7"), "/standings?league=mlb&conference=7");
    assert.equal(parseConferenceParam(null), "all");
    assert.equal(parseConferenceParam("8"), "8");
    assert.equal(parseConferenceParam("all"), "all");
    assert.equal(parseConferenceParam("nope!"), "all");
  });
});
