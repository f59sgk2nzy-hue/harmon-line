import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardHref } from "./board-url";
import {
  REGULAR_SEASON_TYPE,
  espnScoreboardPath,
  parseRegularSeasonWeeks,
  parseSeasonType,
  parseSeasonYear,
  parseWeekParam,
  weekForEspnDate,
} from "./espn-weeks";

const CALENDAR_FIXTURE = {
  leagues: [
    {
      calendar: [
        {
          label: "Regular Season",
          value: "2",
          entries: [
            {
              label: "Week 1",
              detail: "Aug 22-Sep 7",
              value: "1",
              startDate: "2026-08-22T07:00Z",
              endDate: "2026-09-08T06:59Z",
            },
            {
              label: "Week 2",
              detail: "Sep 8-13",
              value: "2",
              startDate: "2026-09-08T07:00Z",
              endDate: "2026-09-14T06:59Z",
            },
            {
              label: "Week 3",
              detail: "Sep 14-20",
              value: "3",
              startDate: "2026-09-14T07:00Z",
              endDate: "2026-09-21T06:59Z",
            },
            {
              label: "Week 15",
              detail: "Dec 7-12",
              value: "15",
              startDate: "2026-12-07T08:00Z",
              endDate: "2026-12-13T07:59Z",
            },
          ],
        },
        {
          label: "Postseason",
          value: "3",
          entries: [
            {
              label: "Bowls",
              detail: "Dec 13-Jan 27",
              value: "1",
              startDate: "2026-12-13T08:00Z",
              endDate: "2027-01-28T07:59Z",
            },
          ],
        },
        {
          label: "Off Season",
          value: "4",
          entries: [
            {
              label: "All-Star",
              value: "1",
              startDate: "2027-01-28T08:00Z",
              endDate: "2027-02-01T07:59Z",
            },
          ],
        },
      ],
    },
  ],
};

describe("parseWeekParam", () => {
  it("reads a positive CFB week integer", () => {
    assert.equal(parseWeekParam("3"), 3);
    assert.equal(parseWeekParam("15"), 15);
  });

  it("rejects missing, zero, non-integers, and out-of-range values", () => {
    assert.equal(parseWeekParam(null), null);
    assert.equal(parseWeekParam(""), null);
    assert.equal(parseWeekParam("0"), null);
    assert.equal(parseWeekParam("1.5"), null);
    assert.equal(parseWeekParam("week3"), null);
    assert.equal(parseWeekParam("99"), null);
  });
});

describe("parseSeasonType", () => {
  it("v0 keeps regular season even if the URL asks for bowls or preseason", () => {
    assert.equal(parseSeasonType("2"), REGULAR_SEASON_TYPE);
    assert.equal(parseSeasonType("3"), REGULAR_SEASON_TYPE);
    assert.equal(parseSeasonType("1"), REGULAR_SEASON_TYPE);
    assert.equal(parseSeasonType(null), REGULAR_SEASON_TYPE);
  });
});

describe("parseSeasonYear", () => {
  it("prefers an explicit 4-digit year and otherwise uses the Eastern date", () => {
    assert.equal(parseSeasonYear("2025", "20260915"), 2025);
    assert.equal(parseSeasonYear(null, "20260915"), 2026);
    assert.equal(parseSeasonYear("nope", "20240907"), 2024);
    assert.equal(parseSeasonYear(null, null), null);
  });
});

describe("parseRegularSeasonWeeks", () => {
  it("reads ESPN regular-season calendar entries and ignores bowls", () => {
    const weeks = parseRegularSeasonWeeks(CALENDAR_FIXTURE);
    assert.deepEqual(
      weeks.map((week) => week.number),
      [1, 2, 3, 15]
    );
    assert.equal(weeks.every((week) => week.seasonType === 2), true);
    assert.equal(weeks[2]?.detail, "Sep 14-20");
    assert.equal(weeks[0]?.startEspnDate, "20260822");
    assert.equal(
      weeks.some((week) => week.label === "Bowls" || week.seasonType === 3),
      false
    );
  });

  it("returns an empty list instead of inventing weeks when ESPN omitted the calendar", () => {
    assert.deepEqual(parseRegularSeasonWeeks({}), []);
    assert.deepEqual(parseRegularSeasonWeeks({ leagues: [{ calendar: [] }] }), []);
  });
});

describe("weekForEspnDate", () => {
  const weeks = parseRegularSeasonWeeks(CALENDAR_FIXTURE);

  it("maps Eastern calendar days onto ESPN week windows", () => {
    assert.equal(weekForEspnDate("20260915", weeks)?.number, 3);
    assert.equal(weekForEspnDate("20260907", weeks)?.number, 1);
    assert.equal(weekForEspnDate("20260908", weeks)?.number, 2);
    assert.equal(weekForEspnDate("20260914", weeks)?.number, 3);
    assert.equal(weekForEspnDate("20260920", weeks)?.number, 3);
    assert.equal(weekForEspnDate("20261212", weeks)?.number, 15);
  });

  it("does not pretend a bowl date is a regular-season week", () => {
    assert.equal(weekForEspnDate("20261213", weeks), null);
    assert.equal(weekForEspnDate("20260701", weeks), null);
  });
});

describe("espnScoreboardPath", () => {
  it("keeps the existing Eastern date query in date mode", () => {
    assert.equal(
      espnScoreboardPath({ group: "80", date: "20260915" }),
      "/scoreboard?groups=80&dates=20260915&limit=300"
    );
  });

  it("loads a week slate with ESPN week/year/seasontype, not a fabricated dates range", () => {
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

  it("uses dates=YYYY when jumping to another season's week", () => {
    assert.equal(
      espnScoreboardPath({
        group: "81",
        date: "20250906",
        week: 2,
        year: 2025,
        view: "week",
      }),
      "/scoreboard?groups=81&week=2&seasontype=2&dates=2025&limit=300"
    );
  });
});

describe("boardHref week params", () => {
  it("adds week and year when the board is in week mode", () => {
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

  it("omits week when navigating by Eastern date only", () => {
    assert.equal(
      boardHref({
        division: "d1",
        date: "20260916",
      }),
      "/?division=d1&date=20260916"
    );
  });
});
