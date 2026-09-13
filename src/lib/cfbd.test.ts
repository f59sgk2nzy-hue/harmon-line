import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cfbdCoverage, cfbdKeyConfigured, mergeCfbdStats, parseCfbdSeasonRows } from "./cfbd";
import { emptyTeamSeasonStats } from "./espn-stats";

describe("cfbdKeyConfigured", () => {
  it("is false when CFBD_API_KEY is missing so the UI stays honestly empty", () => {
    assert.equal(cfbdKeyConfigured({}), false);
    assert.equal(cfbdKeyConfigured({ CFBD_API_KEY: "   " }), false);
    assert.equal(cfbdKeyConfigured({ CFBD_API_KEY: "abc" }), true);
  });
});

describe("parseCfbdSeasonRows", () => {
  it("reads published CFBD rows and ignores junk", () => {
    const parsed = parseCfbdSeasonRows([
      { statName: "pointsPerGame", statValue: 38.2 },
      { statName: "unknownThing", statValue: 99 },
      { name: "rushingYardsPerGame", value: 180 },
    ]);
    assert.equal(parsed.pointsPerGame, 38.2);
    assert.equal(parsed.rushingYardsPerGame, 180);
    assert.equal(parsed.sacks, undefined);
  });

  it("returns an empty object instead of inventing CFBD stats", () => {
    assert.deepEqual(parseCfbdSeasonRows([]), {});
    assert.deepEqual(parseCfbdSeasonRows(undefined), {});
  });
});

describe("mergeCfbdStats", () => {
  it("fills only blank ESPN cells and never overwrites a published ESPN number", () => {
    const espn = { ...emptyTeamSeasonStats(), available: true, pointsPerGame: 40, gamesPlayed: 2 };
    const { stats, filled } = mergeCfbdStats(espn, {
      pointsPerGame: 99,
      pointsAllowedPerGame: 17,
    });
    assert.equal(stats.pointsPerGame, 40);
    assert.equal(stats.pointsAllowedPerGame, 17);
    assert.deepEqual(filled, ["pointsAllowedPerGame"]);
  });
});

describe("cfbdCoverage", () => {
  it("labels a missing key instead of pretending CFBD loaded", () => {
    const note = cfbdCoverage(false, 0);
    assert.match(note.headline, /NOT SET/);
    assert.match(note.detail, /CFBD_API_KEY/);
  });
});
