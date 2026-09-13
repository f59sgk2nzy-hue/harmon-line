import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleTeamPage,
  parseRosterAthletes,
  parseScheduleEvents,
  parseTeamProfile,
  splitSchedule,
} from "./espn-team";

const TEAM_PAYLOAD = {
  team: {
    id: "333",
    displayName: "Alabama Crimson Tide",
    shortDisplayName: "Alabama",
    abbreviation: "ALA",
    color: "9e1b32",
    alternateColor: "ffffff",
    record: { items: [{ type: "total", summary: "2-0" }] },
    standingSummary: "1st in SEC",
    rank: { current: 4 },
    groups: { id: "8", parent: { id: "80" }, isConference: true },
  },
};

const SCHEDULE_EVENTS = [
  {
    id: "401856634",
    date: "2026-09-05T16:00Z",
    week: { number: 1 },
    competitions: [
      {
        status: { type: { state: "post", completed: true, shortDetail: "Final" } },
        venue: { fullName: "Bryant-Denny Stadium" },
        broadcasts: [{ media: { shortName: "ABC" } }],
        competitors: [
          {
            homeAway: "home",
            winner: true,
            score: { value: 48, displayValue: "48" },
            team: { id: "333", abbreviation: "ALA", displayName: "Alabama Crimson Tide" },
          },
          {
            homeAway: "away",
            winner: false,
            score: { value: 10, displayValue: "10" },
            team: { id: "151", abbreviation: "ECU", displayName: "East Carolina Pirates" },
          },
        ],
      },
    ],
  },
  {
    id: "401856685",
    date: "2026-09-19T19:30Z",
    week: { number: 3 },
    competitions: [
      {
        status: {
          type: { state: "pre", completed: false, shortDetail: "9/19 - 3:30 PM EDT" },
        },
        venue: { fullName: "Bryant-Denny Stadium" },
        broadcasts: [{ media: { shortName: "ABC" } }],
        competitors: [
          {
            homeAway: "home",
            team: { id: "333", abbreviation: "ALA", displayName: "Alabama Crimson Tide" },
          },
          {
            homeAway: "away",
            team: { id: "52", abbreviation: "FSU", displayName: "Florida State Seminoles" },
          },
        ],
      },
    ],
  },
];

const ROSTER_PAYLOAD = {
  athletes: [
    {
      position: "offense",
      items: [
        {
          id: "5269389",
          displayName: "Chris Booker",
          jersey: "73",
          displayHeight: "6' 5\"",
          displayWeight: "312 lbs",
          position: { abbreviation: "OL", parent: { displayName: "Offense" } },
          experience: { displayValue: "Freshman", abbreviation: "FR" },
        },
      ],
    },
  ],
  coach: [{ firstName: "Kalen", lastName: "DeBoer" }],
};

describe("parseTeamProfile", () => {
  it("reads name, record, standing, and SEC/FBS grouping from a team payload", () => {
    const team = parseTeamProfile(TEAM_PAYLOAD);
    assert.equal(team.id, "333");
    assert.equal(team.abbreviation, "ALA");
    assert.equal(team.record, "2-0");
    assert.equal(team.standing, "1st in SEC");
    assert.equal(team.rank, 4);
    assert.equal(team.subdivision, "FBS");
    assert.equal(team.conferenceId, "8");
  });
});

describe("parseScheduleEvents", () => {
  it("reads opponent, scores, and W/L from ESPN schedule competitions", () => {
    const games = parseScheduleEvents(SCHEDULE_EVENTS, "333");
    assert.equal(games.length, 2);
    const final = games[0];
    assert.equal(final?.id, "401856634");
    assert.equal(final?.homeAway, "home");
    assert.equal(final?.opponent.abbreviation, "ECU");
    assert.equal(final?.teamScore, 48);
    assert.equal(final?.opponentScore, 10);
    assert.equal(final?.result, "W");
    assert.equal(final?.state, "post");
    assert.equal(games[1]?.result, null);
    assert.equal(games[1]?.opponent.abbreviation, "FSU");
    assert.equal(games[1]?.state, "pre");
  });

  it("returns an empty list instead of inventing games", () => {
    assert.deepEqual(parseScheduleEvents([], "333"), []);
    assert.deepEqual(parseScheduleEvents(undefined, "333"), []);
  });
});

describe("splitSchedule", () => {
  it("puts finals in recent (newest first) and scheduled games in upcoming", () => {
    const games = parseScheduleEvents(SCHEDULE_EVENTS, "333");
    const { recent, upcoming } = splitSchedule(games);
    assert.deepEqual(recent.map((g) => g.id), ["401856634"]);
    assert.deepEqual(upcoming.map((g) => g.id), ["401856685"]);
  });
});

describe("parseRosterAthletes", () => {
  it("flattens position groups into jersey/position/class rows", () => {
    const { players, coach } = parseRosterAthletes(ROSTER_PAYLOAD);
    assert.equal(coach, "Kalen DeBoer");
    assert.equal(players.length, 1);
    assert.equal(players[0]?.name, "Chris Booker");
    assert.equal(players[0]?.jersey, "73");
    assert.equal(players[0]?.position, "OL");
    assert.equal(players[0]?.positionGroup, "Offense");
    assert.equal(players[0]?.classYear, "FR");
  });

  it("returns an empty roster when ESPN omitted athletes", () => {
    const empty = parseRosterAthletes({ athletes: [] });
    assert.deepEqual(empty.players, []);
    assert.equal(empty.coach, null);
  });
});

describe("assembleTeamPage", () => {
  it("labels missing D2/NAIA roster and schedule instead of inventing them", () => {
    const page = assembleTeamPage({
      team: {
        ...parseTeamProfile(TEAM_PAYLOAD),
        subdivision: "NAIA",
        name: "Example NAIA",
      },
      games: [],
      players: [],
      coach: null,
    });
    assert.equal(page.demo, false);
    assert.equal(page.recent.length, 0);
    assert.equal(page.upcoming.length, 0);
    assert.equal(page.roster.length, 0);
    assert.match(page.coverage.schedule.headline, /NOT ON THIS FEED|NOT PUBLISHED/i);
    assert.match(page.coverage.roster.headline, /NOT ON THIS FEED|NOT PUBLISHED/i);
    assert.match(page.coverage.roster.detail, /NAIA/i);
  });

  it("keeps a live FBS schedule and roster when ESPN published them", () => {
    const games = parseScheduleEvents(SCHEDULE_EVENTS, "333");
    const { players, coach } = parseRosterAthletes(ROSTER_PAYLOAD);
    const page = assembleTeamPage({
      team: parseTeamProfile(TEAM_PAYLOAD),
      games,
      players,
      coach,
    });
    assert.equal(page.recent.length, 1);
    assert.equal(page.upcoming.length, 1);
    assert.equal(page.roster.length, 1);
    assert.equal(page.coach, "Kalen DeBoer");
    assert.doesNotMatch(page.coverage.schedule.headline, /NOT ON THIS FEED/i);
  });
});
