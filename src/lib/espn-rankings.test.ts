import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POLL_TABS,
  assembleRankingsPage,
  parsePollParam,
  parseRankTrend,
  parseRankingsPayload,
} from "./espn-rankings";

const PAYLOAD = {
  requestedSeason: {
    year: 2026,
    week: { number: 3, displayValue: "Week 3" },
  },
  rankings: [
    {
      id: "1",
      name: "AP Top 25",
      shortName: "AP Poll",
      type: "ap",
      headline: "2026 NCAA Football Rankings - AP Poll Week 3",
      occurrence: { number: 3, displayValue: "Week 3" },
      ranks: [
        {
          current: 1,
          previous: 4,
          points: 1678,
          trend: "+3",
          recordSummary: "2-0",
          team: {
            id: "251",
            location: "Texas",
            name: "Longhorns",
            nickname: "Texas",
            abbreviation: "TEX",
            color: "af5c37",
            logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png",
          },
        },
        {
          current: 6,
          previous: 1,
          points: 1401,
          trend: "-5",
          recordSummary: "1-1",
          team: {
            id: "194",
            nickname: "Ohio State",
            abbreviation: "OSU",
            color: "de3121",
          },
        },
        {
          current: 19,
          previous: 0,
          points: 412,
          trend: "+7",
          recordSummary: "2-0",
          team: {
            id: "130",
            nickname: "Michigan",
            abbreviation: "MICH",
          },
        },
        {
          current: 12,
          previous: 12,
          points: 901,
          trend: "-",
          recordSummary: "2-0",
          team: {
            id: "333",
            nickname: "Alabama",
            abbreviation: "ALA",
          },
        },
        {
          current: 22,
          previous: 18,
          recordSummary: "1-1",
          team: {
            id: "52",
            nickname: "Florida State",
            abbreviation: "FSU",
          },
        },
        {
          current: 23,
          previous: 20,
          points: 88,
          trend: "-2",
          recordSummary: "1-1",
          team: { nickname: "No Id School", abbreviation: "XXX" },
        },
      ],
    },
    {
      id: "2",
      name: "AFCA Coaches Poll",
      shortName: "AFCA Coaches Poll",
      type: "usa",
      headline: "2026 NCAA Football Rankings - AFCA Coaches Poll Week 3",
      occurrence: { number: 3, displayValue: "Week 3" },
      ranks: [
        {
          current: 1,
          previous: 3,
          points: 1804,
          trend: "+2",
          recordSummary: "2-0",
          team: { id: "251", nickname: "Texas", abbreviation: "TEX" },
        },
      ],
    },
    {
      id: "20",
      name: "FCS Coaches Poll",
      shortName: "FCS Coaches Poll",
      type: "fcs",
      headline: "2026 NCAA Football Rankings - FCS Coaches Poll Week 3",
      occurrence: { number: 3, displayValue: "Week 3" },
      ranks: [
        {
          current: 1,
          previous: 1,
          points: 650,
          trend: "-",
          recordSummary: "3-0",
          team: { id: "147", nickname: "Montana St", abbreviation: "MTST" },
        },
      ],
    },
    {
      id: "11",
      name: "AFCA Division II Coaches Poll",
      shortName: "AFCA Div II",
      type: "afca",
      headline: "2026 NCAA Football Rankings - AFCA Div II Week 3",
      occurrence: { number: 3, displayValue: "Week 3" },
      ranks: [
        {
          current: 1,
          previous: 1,
          points: 775,
          trend: "-",
          recordSummary: "3-0",
          team: { id: "2222", nickname: "Ferris St", abbreviation: "FRST" },
        },
      ],
    },
    {
      id: "12",
      name: "AFCA Division III Coaches Poll",
      shortName: "AFCA Div III",
      type: "afca",
      headline: "2026 NCAA Football Rankings - AFCA Div III Week 3",
      occurrence: { number: 3, displayValue: "Week 3" },
      ranks: [
        {
          current: 1,
          previous: 1,
          points: 1324,
          trend: "-",
          recordSummary: "2-0",
          team: { id: "3071", nickname: "N Central (IL)", abbreviation: "NOR" },
        },
      ],
    },
  ],
};

describe("parsePollParam", () => {
  it("defaults unknown or empty values to AP", () => {
    assert.equal(parsePollParam(null), "ap");
    assert.equal(parsePollParam(""), "ap");
    assert.equal(parsePollParam("playoff"), "ap");
  });

  it("accepts AP, Coaches, FCS, D2, and D3 slugs", () => {
    assert.equal(parsePollParam("ap"), "ap");
    assert.equal(parsePollParam("coaches"), "coaches");
    assert.equal(parsePollParam("fcs"), "fcs");
    assert.equal(parsePollParam("d2"), "d2");
    assert.equal(parsePollParam("d3"), "d3");
  });
});

describe("parseRankTrend", () => {
  it("uses ESPN trend text only and does not invent movement", () => {
    assert.deepEqual(parseRankTrend("+3"), { direction: "up", label: "+3" });
    assert.deepEqual(parseRankTrend("-5"), { direction: "down", label: "-5" });
    assert.deepEqual(parseRankTrend("-"), { direction: "even", label: "-" });
    assert.deepEqual(parseRankTrend(""), { direction: null, label: null });
    assert.deepEqual(parseRankTrend(undefined), { direction: null, label: null });
    assert.deepEqual(parseRankTrend("NR"), { direction: null, label: "NR" });
  });
});

describe("parseRankingsPayload", () => {
  it("maps AP, Coaches, FCS, D2, and D3 from the same ESPN rankings JSON", () => {
    const polls = parseRankingsPayload(PAYLOAD);
    assert.deepEqual(
      polls.map((poll) => poll.id),
      ["ap", "coaches", "fcs", "d2", "d3"]
    );
    assert.equal(polls.find((poll) => poll.id === "ap")?.name, "AP Top 25");
    assert.equal(polls.find((poll) => poll.id === "coaches")?.name, "AFCA Coaches Poll");
    assert.equal(polls.find((poll) => poll.id === "fcs")?.ranks[0]?.team.id, "147");
    assert.equal(polls.find((poll) => poll.id === "d2")?.ranks[0]?.team.id, "2222");
    assert.equal(polls.find((poll) => poll.id === "d3")?.ranks[0]?.team.id, "3071");
  });

  it("keeps ESPN rank, record, points, and team id for /team/{espnId} links", () => {
    const ap = parseRankingsPayload(PAYLOAD).find((poll) => poll.id === "ap");
    assert.ok(ap);
    const texas = ap.ranks[0];
    assert.equal(texas?.rank, 1);
    assert.equal(texas?.team.id, "251");
    assert.equal(texas?.team.name, "Texas");
    assert.equal(texas?.record, "2-0");
    assert.equal(texas?.points, 1678);
    assert.equal(texas?.previous, 4);
    assert.equal(texas?.trend.direction, "up");
    assert.equal(texas?.trend.label, "+3");
    assert.equal(texas?.team.logo, "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png");
  });

  it("does not fabricate poll points when ESPN omitted them", () => {
    const ap = parseRankingsPayload(PAYLOAD).find((poll) => poll.id === "ap");
    const fsu = ap?.ranks.find((row) => row.team.id === "52");
    assert.equal(fsu?.points, null);
    assert.equal(fsu?.trend.direction, null);
    assert.equal(fsu?.trend.label, null);
  });

  it("drops ranked rows that have no ESPN team id", () => {
    const ap = parseRankingsPayload(PAYLOAD).find((poll) => poll.id === "ap");
    assert.equal(ap?.ranks.some((row) => row.team.name === "No Id School"), false);
    assert.equal(ap?.ranks.length, 5);
  });

  it("builds a logo from the ESPN team id when the payload omitted logo", () => {
    const ap = parseRankingsPayload(PAYLOAD).find((poll) => poll.id === "ap");
    const ohio = ap?.ranks.find((row) => row.team.id === "194");
    assert.equal(ohio?.team.logo, "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png");
    assert.equal(ohio?.trend.direction, "down");
  });
});

describe("assembleRankingsPage", () => {
  it("selects the requested poll and never marks rankings as demo", () => {
    const page = assembleRankingsPage({
      payload: PAYLOAD,
      poll: "fcs",
      now: new Date("2026-09-15T16:00:00Z"),
    });
    assert.equal(page.source, "espn");
    assert.equal(page.demo, false);
    assert.equal(page.poll, "fcs");
    assert.equal(page.selected?.id, "fcs");
    assert.equal(page.selected?.ranks[0]?.team.name, "Montana St");
    assert.equal(page.week, 3);
    assert.match(page.coverage.detail, /espn/i);
    assert.doesNotMatch(page.coverage.detail, /sample|demo scores/i);
  });

  it("keeps an unpublished poll selected with an empty list instead of inventing ranks", () => {
    const page = assembleRankingsPage({
      payload: { rankings: [PAYLOAD.rankings[0]] },
      poll: "d2",
    });
    assert.equal(page.poll, "d2");
    assert.equal(page.selected?.id, "d2");
    assert.equal(page.selected?.ranks.length, 0);
    assert.match(page.selected?.headline ?? "", /not published/i);
  });

  it("exposes every shipped poll tab even when ESPN omitted that poll", () => {
    const page = assembleRankingsPage({
      payload: { rankings: [PAYLOAD.rankings[0]] },
      poll: "ap",
    });
    assert.deepEqual(
      page.polls.map((poll) => poll.id),
      POLL_TABS.map((tab) => tab.id)
    );
    const d3 = page.polls.find((poll) => poll.id === "d3");
    assert.equal(d3?.ranks.length, 0);
    assert.match(d3?.headline ?? "", /not published/i);
  });
});
