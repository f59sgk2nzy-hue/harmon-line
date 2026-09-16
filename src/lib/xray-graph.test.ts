import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWinProbability } from "./espn-winprob";
import { layoutXrayGraph, scrubIndexFromX } from "./xray-graph";

const SERIES = parseWinProbability(
  {
    header: {
      competitions: [
        {
          competitors: [
            { homeAway: "home", team: { abbreviation: "CLE", displayName: "Guardians" } },
            { homeAway: "away", team: { abbreviation: "CHW", displayName: "White Sox" } },
          ],
        },
      ],
    },
    winprobability: [
      { playId: "a", homeWinPercentage: 0.25 },
      { playId: "b", homeWinPercentage: 0.5 },
      { playId: "c", homeWinPercentage: 1 },
    ],
    plays: [
      { id: "a", text: "Away triple" },
      { id: "b", text: "Groundout" },
      { id: "c", text: "Walk-off homer" },
    ],
  },
  { league: "mlb", gameId: "401816960" }
);

describe("layoutXrayGraph", () => {
  it("plots every published WP point and a 50% midline without inventing extras", () => {
    const layout = layoutXrayGraph(SERIES, { width: 1000, height: 360 });
    assert.equal(layout.points.length, 3);
    assert.equal(layout.path.includes("NaN"), false);
    assert.ok(layout.path.startsWith("M "));
    assert.equal(layout.midlineY, layout.plot.y + layout.plot.height / 2);
    assert.ok(layout.points[0]!.y > layout.points[2]!.y);
    assert.equal(layout.points[2]!.homeWinPct, 1);
  });

  it("maps pointer X to the nearest published index for mouse and touch scrub", () => {
    const layout = layoutXrayGraph(SERIES, { width: 1000, height: 360 });
    assert.equal(scrubIndexFromX(layout, layout.points[0]!.x), 0);
    assert.equal(scrubIndexFromX(layout, layout.points[2]!.x), 2);
    const midX = (layout.points[1]!.x + layout.points[2]!.x) / 2;
    const nearer = scrubIndexFromX(layout, midX);
    assert.ok(nearer === 1 || nearer === 2);
  });

  it("does not invent a wave when ESPN omitted the series", () => {
    const empty = parseWinProbability({}, { league: "mlb", gameId: "1" });
    const layout = layoutXrayGraph(empty, { width: 1000, height: 360 });
    assert.equal(empty.honesty.headline, "WIN PROBABILITY NOT ON THIS FEED");
    assert.deepEqual(layout.points, []);
    assert.equal(layout.path, "");
    assert.equal(scrubIndexFromX(layout, 400), null);
  });
});
