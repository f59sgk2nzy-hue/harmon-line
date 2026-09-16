import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEAGUE_IDS } from "./leagues";
import type { HighlightVideo } from "./youtube";
import {
  assembleHighlights,
  currentSeasonYear,
  emptyHighlightsBoard,
  highlightsSearchQueries,
  highlightsSourceNote,
  isCurrentSeasonVideo,
  isLeagueVideo,
  youtubeChannelsFor,
  youtubeThumbnailUrl,
} from "./youtube";

function clip(partial: Partial<HighlightVideo> & Pick<HighlightVideo, "id" | "title">): HighlightVideo {
  return {
    channel: "Test Channel",
    publishedAt: "2026-09-13T12:00:00.000Z",
    thumbnailUrl: youtubeThumbnailUrl(partial.id),
    watchUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    kind: "highlight",
    sample: false,
    ...partial,
  };
}

describe("youtubeChannelsFor", () => {
  it("keeps the curated CFB RSS list as the default league feed", () => {
    const cfb = youtubeChannelsFor("cfb");
    assert.ok(cfb.some((c) => c.label === "ESPN College Football"));
    assert.ok(cfb.some((c) => c.kind === "highlight"));
    assert.ok(cfb.some((c) => c.kind === "reaction"));
  });

  it("registers distinct highlight + reaction channels for every shipped league", () => {
    for (const league of LEAGUE_IDS) {
      const channels = youtubeChannelsFor(league);
      assert.ok(channels.length >= 3, `${league} should have curated RSS channels`);
      assert.ok(channels.some((c) => c.kind === "highlight"), `${league} needs highlight channels`);
      assert.ok(channels.some((c) => c.kind === "reaction"), `${league} needs reaction channels`);
      assert.equal(new Set(channels.map((c) => c.id)).size, channels.length);
    }
  });

  it("does not reuse the ESPN College Football channel on NBA/MLB/NFL/MBB", () => {
    const cfbIds = new Set(youtubeChannelsFor("cfb").map((c) => c.id));
    for (const league of ["mbb", "nfl", "nba", "mlb"] as const) {
      const overlap = youtubeChannelsFor(league).filter((c) => cfbIds.has(c.id) && c.label.includes("College Football"));
      assert.deepEqual(overlap, []);
    }
  });
});

describe("isLeagueVideo", () => {
  it("keeps CFB titles on CFB and drops them on NBA", () => {
    const title = "Arkansas Razorbacks vs. Utah Utes | Full Game Highlights";
    const channel = "ESPN College Football";
    assert.equal(isLeagueVideo("cfb", title, channel), true);
    assert.equal(isLeagueVideo("nba", title, channel), false);
    assert.equal(isLeagueVideo("mlb", title, channel), false);
    assert.equal(isLeagueVideo("mbb", title, channel), false);
  });

  it("keeps NBA dunks on NBA and drops them on CFB/NFL", () => {
    const title = "Lakers vs Celtics | NBA Highlights";
    const channel = "NBA";
    assert.equal(isLeagueVideo("nba", title, channel), true);
    assert.equal(isLeagueVideo("cfb", title, channel), false);
    assert.equal(isLeagueVideo("nfl", title, channel), false);
    assert.equal(isLeagueVideo("mlb", title, channel), false);
  });

  it("keeps NFL and MLB official-channel clips on their boards only", () => {
    assert.equal(isLeagueVideo("nfl", "Chiefs vs Bills Week 2 Highlights", "NFL"), true);
    assert.equal(isLeagueVideo("nba", "Chiefs vs Bills Week 2 Highlights", "NFL"), false);
    assert.equal(isLeagueVideo("mlb", "Dodgers walk-off home run", "MLB"), true);
    assert.equal(isLeagueVideo("nfl", "Dodgers walk-off home run", "MLB"), false);
  });

  it("keeps college basketball on MBB and drops football leaks from mixed channels", () => {
    assert.equal(
      isLeagueVideo("mbb", "Duke vs Kansas | Full Game Highlights", "March Madness"),
      true
    );
    assert.equal(
      isLeagueVideo("mbb", "Michigan vs Ohio State | Football Highlights", "Big Ten Network"),
      false
    );
    assert.equal(
      isLeagueVideo("cfb", "Michigan vs Ohio State | Football Highlights", "Big Ten Network"),
      true
    );
    assert.equal(
      isLeagueVideo(
        "mbb",
        "Just a couple of Texas icons #texasfootball #hookem #archmanning",
        "CBS Sports"
      ),
      false
    );
  });
});

describe("assembleHighlights league scoping", () => {
  it("defaults omitted league to cfb so existing clients keep working", () => {
    const board = assembleHighlights({
      rssVideos: [clip({ id: "cfb1", title: "College football highlights 2026", channel: "ESPN College Football" })],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.league, "cfb");
    assert.equal(board.demo, false);
    assert.ok(board.videos.some((v) => v.id === "cfb1"));
  });

  it("never labels CFB clips as NBA when the board is NBA", () => {
    const board = assembleHighlights({
      league: "nba",
      rssVideos: [
        clip({
          id: "cfb-leak",
          title: "Arkansas Razorbacks vs. Utah Utes | Full Game Highlights",
          channel: "ESPN College Football",
        }),
        clip({
          id: "nba1",
          title: "Celtics vs Lakers | NBA Highlights",
          channel: "NBA",
        }),
      ],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.league, "nba");
    assert.equal(board.demo, false);
    assert.equal(board.sample, false);
    assert.ok(board.videos.some((v) => v.id === "nba1"));
    assert.ok(board.videos.every((v) => v.id !== "cfb-leak"));
  });

  it("returns an honest empty NBA feed instead of CFB SAMPLE cards", () => {
    const board = assembleHighlights({
      league: "nba",
      rssVideos: [
        clip({
          id: "cfb-only",
          title: "Week 2 College Football Rankings",
          channel: "ESPN College Football",
        }),
      ],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.league, "nba");
    assert.equal(board.demo, false);
    assert.equal(board.sample, false);
    assert.equal(board.source, "empty");
    assert.deepEqual(board.videos, []);
  });

  it("keeps NFL, MBB, and MLB clips on their own boards", () => {
    const nfl = assembleHighlights({
      league: "nfl",
      rssVideos: [clip({ id: "nfl1", title: "NFL Highlights: Chiefs vs Bills", channel: "NFL" })],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    const mbb = assembleHighlights({
      league: "mbb",
      rssVideos: [
        clip({
          id: "mbb1",
          title: "Duke vs Kansas | College Basketball Highlights",
          channel: "March Madness",
        }),
      ],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    const mlb = assembleHighlights({
      league: "mlb",
      rssVideos: [clip({ id: "mlb1", title: "MLB Highlights: Yankees vs Red Sox", channel: "MLB" })],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(nfl.league, "nfl");
    assert.equal(nfl.videos[0]?.id, "nfl1");
    assert.equal(mbb.league, "mbb");
    assert.equal(mbb.videos[0]?.id, "mbb1");
    assert.equal(mlb.league, "mlb");
    assert.equal(mlb.videos[0]?.id, "mlb1");
    assert.equal(nfl.demo, false);
    assert.equal(mbb.demo, false);
    assert.equal(mlb.demo, false);
  });
});

describe("emptyHighlightsBoard", () => {
  it("is labeled empty with demo false and no invented video ids", () => {
    const board = emptyHighlightsBoard("nba", new Date("2026-09-13T18:00:00.000Z"));
    assert.equal(board.league, "nba");
    assert.equal(board.demo, false);
    assert.equal(board.sample, false);
    assert.equal(board.source, "empty");
    assert.deepEqual(board.videos, []);
    assert.match(highlightsSourceNote(board), /NO CLIPS|NOT ON THIS FEED|EMPTY/i);
  });
});

describe("currentSeasonYear", () => {
  it("keeps CFB/NFL on the fall season through January", () => {
    assert.equal(currentSeasonYear("cfb", new Date("2026-09-13T18:00:00.000Z")), 2026);
    assert.equal(currentSeasonYear("nfl", new Date("2026-09-13T18:00:00.000Z")), 2026);
    assert.equal(currentSeasonYear("cfb", new Date("2027-01-12T18:00:00.000Z")), 2026);
    assert.equal(currentSeasonYear("nfl", new Date("2027-01-12T18:00:00.000Z")), 2026);
  });

  it("keeps NBA/MBB on the previous season until the new tip-off window", () => {
    assert.equal(currentSeasonYear("nba", new Date("2026-09-13T18:00:00.000Z")), 2025);
    assert.equal(currentSeasonYear("mbb", new Date("2026-09-13T18:00:00.000Z")), 2025);
    assert.equal(currentSeasonYear("nba", new Date("2026-10-21T18:00:00.000Z")), 2026);
    assert.equal(currentSeasonYear("mbb", new Date("2026-11-15T18:00:00.000Z")), 2026);
  });

  it("uses the MLB calendar year during the regular season", () => {
    assert.equal(currentSeasonYear("mlb", new Date("2026-09-13T18:00:00.000Z")), 2026);
    assert.equal(currentSeasonYear("mlb", new Date("2027-01-12T18:00:00.000Z")), 2026);
  });
});

describe("isCurrentSeasonVideo by league", () => {
  it("keeps June NBA Finals on the 2025-26 season during September 2026", () => {
    assert.equal(isCurrentSeasonVideo("2026-06-12T00:00:00.000Z", 2025, "nba"), true);
    assert.equal(isCurrentSeasonVideo("2024-11-02T00:00:00.000Z", 2025, "nba"), false);
  });

  it("keeps March Madness 2026 on the 2025-26 MBB season", () => {
    assert.equal(isCurrentSeasonVideo("2026-03-20T00:00:00.000Z", 2025, "mbb"), true);
    assert.equal(isCurrentSeasonVideo("2024-03-20T00:00:00.000Z", 2025, "mbb"), false);
  });

  it("keeps September MLB clips on the 2026 calendar season", () => {
    assert.equal(isCurrentSeasonVideo("2026-09-13T00:00:00.000Z", 2026, "mlb"), true);
    assert.equal(isCurrentSeasonVideo("2025-09-13T00:00:00.000Z", 2026, "mlb"), false);
  });
});

describe("highlightsSearchQueries", () => {
  it("scopes optional Data API search strings to the active league and year", () => {
    assert.ok(highlightsSearchQueries("cfb", 2026).some((q) => /college football highlights 2026/i.test(q.q)));
    assert.ok(highlightsSearchQueries("nba", 2026).some((q) => /\bnba highlights 2026/i.test(q.q)));
    assert.ok(highlightsSearchQueries("mbb", 2026).some((q) => /college basketball|march madness/i.test(q.q)));
    assert.ok(highlightsSearchQueries("nfl", 2026).some((q) => /\bnfl highlights 2026/i.test(q.q)));
    assert.ok(highlightsSearchQueries("mlb", 2026).some((q) => /\bmlb highlights 2026/i.test(q.q)));
    assert.ok(highlightsSearchQueries("nba", 2026).every((q) => !/college football/i.test(q.q)));
  });
});
