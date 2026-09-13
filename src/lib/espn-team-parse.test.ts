import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCompetitorScore,
  parseRoster,
  parseScheduleGames,
  parseTeamId,
  parseTeamProfile,
  splitTeamSchedule,
  teamRosterCoverage,
  teamScheduleCoverage,
} from "./espn-team-parse";

describe("parseTeamId", () => {
  it("accepts numeric ESPN team ids only", () => {
    assert.equal(parseTeamId("333"), "333");
    assert.equal(parseTeamId("134001"), "134001");
  });

  it("rejects slugs and empty values so we never guess a school", () => {
    assert.equal(parseTeamId("alabama"), null);
    assert.equal(parseTeamId(""), null);
    assert.equal(parseTeamId(undefined), null);
  });
});

describe("parseCompetitorScore", () => {
  it("reads ESPN schedule score objects instead of inventing zero", () => {
    assert.equal(parseCompetitorScore({ value: 45, displayValue: "45" }), 45);
    assert.equal(parseCompetitorScore({ displayValue: "17" }), 17);
    assert.equal(parseCompetitorScore(48), 48);
  });

  it("keeps a published zero and treats a missing score as null", () => {
    assert.equal(parseCompetitorScore({ value: 0, displayValue: "0" }), 0);
    assert.equal(parseCompetitorScore(null), null);
    assert.equal(parseCompetitorScore({}), null);
  });
});

describe("parseTeamProfile", () => {
  it("classifies Alabama from the FBS parent group, not league 23", () => {
    const team = parseTeamProfile({
      team: {
        id: "333",
        displayName: "Alabama Crimson Tide",
        shortDisplayName: "Alabama",
        abbreviation: "ALA",
        nickname: "Alabama",
        location: "Alabama",
        color: "9e1b32",
        alternateColor: "ffffff",
        record: { items: [{ type: "total", summary: "2-0" }] },
        standingSummary: "1st in SEC",
        groups: { id: "8", parent: { id: "80" }, isConference: true },
      },
    });
    assert.equal(team?.id, "333");
    assert.equal(team?.name, "Alabama Crimson Tide");
    assert.equal(team?.subdivision, "FBS");
    assert.equal(team?.conferenceId, "8");
    assert.equal(team?.record, "2-0");
  });

  it("labels a NAIA group as NAIA and does not treat D2/NAIA buckets as a conference", () => {
    const team = parseTeamProfile({
      team: {
        id: "2615",
        displayName: "St. Xavier (IL) Cougars",
        shortDisplayName: "St. Xavier",
        abbreviation: "STX",
        groups: { id: "186", isConference: false },
      },
    });
    assert.equal(team?.subdivision, "NAIA");
    assert.equal(team?.conferenceId, null);
  });

  it("returns null when ESPN omitted a team id", () => {
    assert.equal(parseTeamProfile({ team: { displayName: "Unknown" } }), null);
  });
});

describe("parseScheduleGames + splitTeamSchedule", () => {
  const alaSchedule = {
    events: [
      {
        id: "401856634",
        date: "2026-09-05T16:00Z",
        name: "East Carolina Pirates at Alabama Crimson Tide",
        shortName: "ECU @ ALA",
        week: { number: 1 },
        competitions: [
          {
            venue: { fullName: "Bryant-Denny Stadium" },
            broadcasts: [{ media: { shortName: "ABC" } }],
            status: { type: { state: "post", detail: "Final", shortDetail: "Final", completed: true } },
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
                team: {
                  id: "151",
                  abbreviation: "ECU",
                  displayName: "East Carolina Pirates",
                  shortDisplayName: "East Carolina",
                },
              },
            ],
          },
        ],
      },
      {
        id: "401856685",
        date: "2026-09-19T19:30Z",
        name: "Florida State Seminoles at Alabama Crimson Tide",
        shortName: "FSU @ ALA",
        week: { number: 3 },
        competitions: [
          {
            venue: { fullName: "Bryant-Denny Stadium" },
            status: {
              type: {
                state: "pre",
                detail: "Sat, September 19th at 3:30 PM EDT",
                shortDetail: "9/19 - 3:30 PM EDT",
                completed: false,
              },
            },
            competitors: [
              {
                homeAway: "home",
                team: { id: "333", abbreviation: "ALA", displayName: "Alabama Crimson Tide" },
              },
              {
                homeAway: "away",
                team: {
                  id: "52",
                  abbreviation: "FSU",
                  displayName: "Florida State Seminoles",
                  shortDisplayName: "Florida State",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  it("maps published scores onto the opponent and never fills missing scores", () => {
    const games = parseScheduleGames(alaSchedule, "333");
    assert.equal(games.length, 2);
    assert.equal(games[0].opponent.abbreviation, "ECU");
    assert.equal(games[0].teamScore, 48);
    assert.equal(games[0].opponentScore, 10);
    assert.equal(games[0].winner, true);
    assert.equal(games[0].homeAway, "home");
    assert.equal(games[1].teamScore, null);
    assert.equal(games[1].opponentScore, null);
    assert.equal(games[1].winner, null);
    assert.equal(games[1].opponent.abbreviation, "FSU");
  });

  it("puts finals in recent (newest first) and scheduled games in upcoming", () => {
    const { recent, upcoming } = splitTeamSchedule(parseScheduleGames(alaSchedule, "333"));
    assert.deepEqual(
      recent.map((g) => g.id),
      ["401856634"]
    );
    assert.deepEqual(
      upcoming.map((g) => g.id),
      ["401856685"]
    );
  });

  it("skips events that do not include this team instead of inventing a result", () => {
    assert.deepEqual(parseScheduleGames(alaSchedule, "999"), []);
    assert.deepEqual(parseScheduleGames({ events: [] }, "333"), []);
  });
});

describe("parseRoster", () => {
  it("keeps named players and drops empty ESPN position buckets", () => {
    const { players, coach } = parseRoster({
      coach: [{ id: "4608671", firstName: "Kalen", lastName: "DeBoer" }],
      athletes: [
        {
          position: "offense",
          items: [
            {
              id: "5269389",
              displayName: "Chris Booker",
              jersey: "73",
              displayHeight: "6' 4\"",
              displayWeight: "288 lbs",
              experience: { displayValue: "Freshman", abbreviation: "FR" },
              birthPlace: { displayText: "Atlanta, GA" },
              position: { abbreviation: "OL", displayName: "Offensive Lineman" },
            },
          ],
        },
        { position: "injuredReserveOrOut", items: [] },
        { position: "defense", items: [{ id: "1" }] },
      ],
    });
    assert.equal(players.length, 1);
    assert.equal(players[0].name, "Chris Booker");
    assert.equal(players[0].jersey, "73");
    assert.equal(players[0].position, "OL");
    assert.equal(players[0].group, "offense");
    assert.equal(players[0].year, "FR");
    assert.equal(players[0].hometown, "Atlanta, GA");
    assert.deepEqual(coach, { id: "4608671", name: "Kalen DeBoer" });
  });

  it("returns an empty roster when ESPN published no athletes", () => {
    const { players, coach } = parseRoster({
      athletes: [
        { position: "offense", items: [] },
        { position: "defense", items: [] },
      ],
    });
    assert.deepEqual(players, []);
    assert.equal(coach, null);
  });
});

describe("team coverage notes", () => {
  it("labels an empty NAIA schedule instead of implying a hidden slate", () => {
    const note = teamScheduleCoverage([], "NAIA", "ok");
    assert.match(note.headline, /no schedule/i);
    assert.match(note.detail, /never invent/i);
  });

  it("labels a missing D2 roster instead of inventing players", () => {
    const note = teamRosterCoverage(0, "D2", "ok");
    assert.match(note.headline, /no roster/i);
    assert.match(note.detail, /never invent/i);
  });

  it("says the feed failed when ESPN was unreachable, not that the team has no games", () => {
    const schedule = teamScheduleCoverage([], "FBS", "error");
    const roster = teamRosterCoverage(0, "FBS", "error");
    assert.match(schedule.headline, /unavailable/i);
    assert.match(roster.headline, /unavailable/i);
  });
});
