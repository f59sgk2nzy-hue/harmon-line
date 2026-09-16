import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sportOpsHref } from "./board-url";
import {
  buildOpsGraph,
  layoutOpsGraph,
  parseBusyParam,
  spokeHasTraffic,
  workIsActive,
} from "./ops";

const FORBIDDEN = /pnl|polymarket|monte.?carlo|winprob|pickcenter|\bats\b|paid.?odds/i;

describe("parseBusyParam", () => {
  it("returns no ids when the query is missing or blank", () => {
    assert.deepEqual(parseBusyParam(null), []);
    assert.deepEqual(parseBusyParam(""), []);
    assert.deepEqual(parseBusyParam("   "), []);
  });

  it("resolves aliases and ignores junk tokens", () => {
    assert.deepEqual(parseBusyParam("board"), ["the-board"]);
    assert.deepEqual(parseBusyParam("the-board,keef"), ["the-board", "chief-keef"]);
    assert.deepEqual(parseBusyParam("hub"), ["chief-keef"]);
    assert.deepEqual(parseBusyParam("nope,board"), ["the-board"]);
  });

  it("expands all to active roster ids only", () => {
    assert.deepEqual(parseBusyParam("all"), ["chief-keef", "the-board"]);
  });
});

describe("buildOpsGraph", () => {
  it("ships a static Harmon Line roster with Chief Keef at the hub", () => {
    const graph = buildOpsGraph({ now: new Date("2026-09-16T19:00:00Z") });
    assert.equal(graph.source, "static-roster");
    assert.equal(graph.demo, false);
    assert.equal(graph.liveFeed, false);
    assert.equal(graph.busyOverride, false);
    assert.equal(graph.generatedAt, "2026-09-16T19:00:00.000Z");
    assert.equal(graph.hub.id, "chief-keef");
    assert.equal(graph.hub.label, "Chief Keef");
    assert.equal(graph.hub.role, "hub");
    assert.equal(graph.hub.kind, "active");
    assert.equal(graph.hub.duty, "idle");
    assert.deepEqual(
      graph.spokes.map((spoke) => spoke.id),
      ["the-board", "cfb-edge", "lab"]
    );
    assert.equal(graph.spokes[0]?.label, "The Board");
    assert.equal(graph.spokes[0]?.kind, "active");
    assert.equal(graph.spokes[1]?.kind, "retired");
    assert.equal(graph.spokes[2]?.kind, "skip");
    assert.match(graph.honesty.headline, /static roster/i);
    assert.match(graph.honesty.detail, /not connected/i);
  });

  it("defaults every node idle and reports no active work", () => {
    const graph = buildOpsGraph();
    assert.equal(graph.hub.duty, "idle");
    assert.ok(graph.spokes.every((spoke) => spoke.duty === "idle"));
    assert.equal(workIsActive(graph), false);
    assert.ok(graph.spokes.every((spoke) => spokeHasTraffic(spoke) === false));
  });

  it("lights The Board from a dogfood busy overlay without claiming a live feed", () => {
    const graph = buildOpsGraph({ busy: "board" });
    assert.equal(graph.busyOverride, true);
    assert.equal(graph.liveFeed, false);
    assert.equal(graph.demo, false);
    assert.equal(graph.hub.duty, "idle");
    assert.equal(graph.spokes[0]?.duty, "busy");
    assert.equal(workIsActive(graph), true);
    assert.equal(spokeHasTraffic(graph.spokes[0]!), true);
    assert.match(graph.honesty.detail, /dogfood/i);
  });

  it("refuses to light retired or skip spokes even if named in busy=", () => {
    const graph = buildOpsGraph({ busy: "lab,cfb-edge,edge" });
    assert.equal(graph.busyOverride, false);
    assert.equal(graph.spokes.find((spoke) => spoke.id === "lab")?.duty, "idle");
    assert.equal(graph.spokes.find((spoke) => spoke.id === "cfb-edge")?.duty, "idle");
    assert.equal(workIsActive(graph), false);
  });

  it("does not invent trading, odds, or dollar chrome", () => {
    const payload = JSON.stringify(buildOpsGraph({ busy: "all" }));
    assert.doesNotMatch(payload, FORBIDDEN);
    assert.match(payload, /"demo":false/);
  });
});

describe("layoutOpsGraph", () => {
  it("places the hub in the center with a spoke and edge for each roster node", () => {
    const graph = buildOpsGraph({ busy: "board" });
    const layout = layoutOpsGraph(graph, { width: 1000, height: 640 });
    assert.equal(layout.hub.x, 500);
    assert.equal(layout.hub.y, 320);
    assert.equal(layout.spokes.length, 3);
    assert.equal(layout.edges.length, 3);
    const board = layout.spokes.find((node) => node.id === "the-board");
    assert.ok(board);
    assert.equal(board.y < layout.hub.y, true);
    const boardEdge = layout.edges.find((edge) => edge.spokeId === "the-board");
    assert.equal(boardEdge?.traffic, true);
    assert.ok(layout.edges.filter((edge) => edge.spokeId !== "the-board").every((edge) => !edge.traffic));
  });
});

describe("sportOpsHref", () => {
  it("keeps CFB ops at /ops and preserves sibling league plus dogfood busy", () => {
    assert.equal(sportOpsHref("cfb"), "/ops");
    assert.equal(sportOpsHref("mbb"), "/ops?league=mbb");
    assert.equal(sportOpsHref("nfl", "board"), "/ops?league=nfl&busy=board");
  });
});
