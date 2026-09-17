import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEAGUE_IDS } from "./leagues";
import { emptyHighlightsBoard, highlightsSourceNote, sampleHighlightsBoard } from "./youtube";
import {
  HIGHLIGHTS_EMPTY_HEADLINE,
  highlightsClientPollOnMount,
  highlightsStripMode,
  homeHighlightsApiPath,
  homeHighlightsQuery,
  shouldRenderHomeHighlightsStrip,
} from "./highlights-home";

describe("shouldRenderHomeHighlightsStrip", () => {
  it("stays on every shipped home board when the scoreboard slate is empty", () => {
    for (const league of LEAGUE_IDS) {
      assert.equal(
        shouldRenderHomeHighlightsStrip({ league, gameCount: 0 }),
        true,
        `${league} strip must render with zero games`
      );
    }
  });

  it("does not require games today, this week, or a non-empty ESPN payload", () => {
    assert.equal(
      shouldRenderHomeHighlightsStrip({ league: "mbb", gameCount: 0 }),
      shouldRenderHomeHighlightsStrip({ league: "mbb", gameCount: 12 })
    );
  });
});

describe("homeHighlightsQuery", () => {
  it("fetches trending clips by league and drops date, week, and games gates", () => {
    const query = homeHighlightsQuery({
      league: "nba",
      date: "20260917",
      week: 3,
      games: [],
    });
    assert.deepEqual(query, { league: "nba" });
    assert.equal("date" in query, false);
    assert.equal("week" in query, false);
    assert.equal("games" in query, false);
  });

  it("keeps each shipped sport on its own highlights path", () => {
    assert.equal(homeHighlightsApiPath("cfb"), "/api/highlights?league=cfb");
    assert.equal(homeHighlightsApiPath("mbb"), "/api/highlights?league=mbb");
    assert.equal(homeHighlightsApiPath("nfl"), "/api/highlights?league=nfl");
    assert.equal(homeHighlightsApiPath("nba"), "/api/highlights?league=nba");
    assert.equal(homeHighlightsApiPath("mlb"), "/api/highlights?league=mlb");
    assert.equal(homeHighlightsApiPath("nba").includes("date="), false);
    assert.equal(homeHighlightsApiPath("nba").includes("week="), false);
  });
});

describe("highlightsStripMode", () => {
  it("keeps strip chrome for an empty YouTube payload instead of hiding the section", () => {
    const empty = emptyHighlightsBoard("mlb", new Date("2026-09-17T18:00:00.000Z"));
    assert.equal(empty.demo, false);
    assert.deepEqual(empty.videos, []);
    assert.equal(highlightsStripMode(empty), "empty-chrome");
    assert.equal(HIGHLIGHTS_EMPTY_HEADLINE, "NO CLIPS ON THIS FEED");
    assert.match(highlightsSourceNote(empty), new RegExp(HIGHLIGHTS_EMPTY_HEADLINE));
  });

  it("shows loading skeletons before a board arrives and clips when videos exist", () => {
    assert.equal(highlightsStripMode(null), "loading");
    assert.equal(highlightsStripMode(sampleHighlightsBoard(new Date("2026-09-13T18:00:00.000Z"))), "clips");
  });
});

describe("highlightsClientPollOnMount", () => {
  it("retries the league feed when SSR painted an empty strip so off-days still hydrate clips", () => {
    const empty = emptyHighlightsBoard("mbb", new Date("2026-09-17T18:00:00.000Z"));
    assert.equal(highlightsClientPollOnMount(empty), true);
    assert.equal(highlightsClientPollOnMount(null), true);
  });

  it("skips an immediate refetch when SSR already has live clips", () => {
    const live = sampleHighlightsBoard(new Date("2026-09-13T18:00:00.000Z"));
    assert.ok(live.videos.length > 0);
    assert.equal(highlightsClientPollOnMount(live), false);
  });
});
