import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIP_EMPTY_HEADLINE,
  CLIP_EVIDENCE_LABEL,
  buildClipSearchQuery,
  clipLookupForGame,
  clipQueryFromSearchParams,
  resolveClipLookup,
  withClipLookup,
} from "./scrub-film";
import { emptyHighlightsBoard, youtubeSearchUrl, youtubeThumbnailUrl, type HighlightVideo } from "./youtube";

function video(
  partial: Partial<HighlightVideo> & Pick<HighlightVideo, "id" | "title">
): HighlightVideo {
  return {
    channel: "ESPN College Football",
    publishedAt: "2026-09-13T12:00:00.000Z",
    thumbnailUrl: youtubeThumbnailUrl(partial.id),
    watchUrl: `https://www.youtube.com/watch?v=${partial.id}`,
    kind: "highlight",
    sample: false,
    ...partial,
  };
}

const OSU_TEXAS = {
  league: "cfb" as const,
  awayName: "Ohio State Buckeyes",
  awayAbbr: "OSU",
  homeName: "Texas Longhorns",
  homeAbbr: "TEX",
};

describe("buildClipSearchQuery", () => {
  it("joins published team names with play text and a sport keyword", () => {
    const q = buildClipSearchQuery({
      ...OSU_TEXAS,
      playText: "Caleb Downs 45 Yd Interception Return",
    });
    assert.match(q, /Ohio State/);
    assert.match(q, /Texas/);
    assert.match(q, /Caleb Downs/);
    assert.match(q, /college football/i);
    assert.match(q, /highlights/i);
    assert.doesNotMatch(q, /espn\.com\/video/i);
  });

  it("uses player + category for a leader line", () => {
    const q = buildClipSearchQuery({
      league: "nba",
      awayName: "Los Angeles Lakers",
      awayAbbr: "LAL",
      homeName: "Boston Celtics",
      homeAbbr: "BOS",
      playerName: "LeBron James",
      category: "points",
    });
    assert.match(q, /Lakers/);
    assert.match(q, /Celtics/);
    assert.match(q, /LeBron James/);
    assert.match(q, /\bnba\b/i);
  });
});

describe("youtubeSearchUrl", () => {
  it("builds a YouTube results URL from the query, never a fabricated watch id", () => {
    const url = youtubeSearchUrl("Ohio State vs Texas highlights");
    assert.equal(
      url,
      "https://www.youtube.com/results?search_query=Ohio%20State%20vs%20Texas%20highlights"
    );
    assert.doesNotMatch(url, /watch\?v=/);
  });
});

describe("resolveClipLookup", () => {
  it("returns demo:false and a real watch URL when both teams are on a feed title", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "abcOSUTEX",
          title: "Ohio State vs Texas | Full Game Highlights",
        }),
        video({
          id: "zzzBAMA",
          title: "Alabama vs Georgia | Full Game Highlights",
        }),
      ],
      ...OSU_TEXAS,
      playText: "Caleb Downs 45 Yd Interception Return",
    });
    assert.equal(clip.demo, false);
    assert.equal(clip.match?.id, "abcOSUTEX");
    assert.equal(clip.match?.watchUrl, "https://www.youtube.com/watch?v=abcOSUTEX");
    assert.equal(clip.match?.title, "Ohio State vs Texas | Full Game Highlights");
    assert.equal(clip.emptyHeadline, null);
    assert.equal(clip.evidenceLabel, CLIP_EVIDENCE_LABEL);
    assert.ok(clip.searchUrl.startsWith("https://www.youtube.com/results?"));
  });

  it("matches one team plus a distinctive player token from the play text", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "downPick",
          title: "Caleb Downs pick-six vs Texas — Ohio State highlights",
        }),
      ],
      ...OSU_TEXAS,
      playText: "Caleb Downs 45 Yd Interception Return (Jayden Fielding Kick)",
    });
    assert.equal(clip.match?.id, "downPick");
  });

  it("returns NO CLIP ON THIS FEED when the feed has no related video", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "bamauga",
          title: "Alabama vs Georgia | Full Game Highlights",
        }),
      ],
      ...OSU_TEXAS,
      playText: "Caleb Downs 45 Yd Interception Return",
    });
    assert.equal(clip.match, null);
    assert.equal(clip.emptyHeadline, CLIP_EMPTY_HEADLINE);
    assert.equal(clip.emptyHeadline, "NO CLIP ON THIS FEED");
    assert.equal(clip.evidenceLabel, null);
    assert.equal(clip.demo, false);
    assert.ok(clip.searchUrl.includes("youtube.com/results"));
  });

  it("does not invent clip titles or watch URLs, and skips sample cards", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "sample-highlight-1",
          title: "SAMPLE — 2026 college football highlights (live YouTube feed unavailable)",
          sample: true,
          watchUrl: "https://www.youtube.com/results?search_query=college+football",
        }),
      ],
      ...OSU_TEXAS,
      playText: "Quinshon Judkins 3 Yd Run",
    });
    assert.equal(clip.match, null);
    assert.equal(clip.emptyHeadline, "NO CLIP ON THIS FEED");
    assert.doesNotMatch(JSON.stringify(clip), /espn\.com\/video\/clip/i);
  });

  it("never treats an ESPN video/clip href as a match", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "espn-drm",
          title: "Ohio State vs Texas | Full Game Highlights",
          watchUrl: "https://www.espn.com/video/clip/_/id/49953740/clip",
        }),
      ],
      ...OSU_TEXAS,
      playText: "Howard 45 Yd Interception Return",
    });
    assert.equal(clip.match, null);
    assert.equal(clip.emptyHeadline, "NO CLIP ON THIS FEED");
  });

  it("matches NBA leaders against an NBA highlights title", () => {
    const clip = resolveClipLookup({
      videos: [
        video({
          id: "lalbos",
          title: "Lakers vs Celtics | NBA Highlights",
          channel: "NBA",
        }),
      ],
      league: "nba",
      awayName: "Los Angeles Lakers",
      awayAbbr: "LAL",
      homeName: "Boston Celtics",
      homeAbbr: "BOS",
      playerName: "LeBron James",
      category: "points",
    });
    assert.equal(clip.match?.id, "lalbos");
    assert.equal(clip.demo, false);
  });
});

describe("withClipLookup", () => {
  it("attaches clip to a highlights board without inventing videos[] entries", () => {
    const board = emptyHighlightsBoard("cfb", new Date("2026-09-16T18:00:00.000Z"), false);
    const next = withClipLookup(board, {
      ...OSU_TEXAS,
      playText: "Touchdown pass",
    });
    assert.equal(next.demo, false);
    assert.deepEqual(next.videos, []);
    assert.equal(next.clip?.match, null);
    assert.equal(next.clip?.emptyHeadline, "NO CLIP ON THIS FEED");
    assert.equal(next.clip?.demo, false);
  });

  it("still returns demo:false and NO CLIP when only league is provided", () => {
    const board = emptyHighlightsBoard("nfl");
    const next = withClipLookup(board, { league: "nfl" });
    assert.equal(next.demo, false);
    assert.equal(next.clip.demo, false);
    assert.equal(next.clip.match, null);
    assert.equal(next.clip.emptyHeadline, "NO CLIP ON THIS FEED");
  });
});

describe("clipQueryFromSearchParams", () => {
  it("is null for the home-strip call (league only)", () => {
    assert.equal(clipQueryFromSearchParams(new URLSearchParams("league=cfb")), null);
  });

  it("reads away, home, and play text for /api/highlights search", () => {
    const query = clipQueryFromSearchParams(
      new URLSearchParams("league=nba&away=Los+Angeles+Lakers&home=Boston+Celtics&q=LeBron+James+dunk")
    );
    assert.equal(query?.league, "nba");
    assert.equal(query?.awayName, "Los Angeles Lakers");
    assert.equal(query?.homeName, "Boston Celtics");
    assert.equal(query?.playText, "LeBron James dunk");
  });
});

describe("clipLookupForGame", () => {
  it("uses published team names from the game object", () => {
    const clip = clipLookupForGame(
      [
        video({
          id: "osuTexHL",
          title: "Ohio State vs Texas | Full Game Highlights",
        }),
      ],
      {
        league: "cfb",
        away: { name: "Ohio State Buckeyes", shortName: "Ohio State", abbreviation: "OSU" },
        home: { name: "Texas Longhorns", shortName: "Texas", abbreviation: "TEX" },
        playText: "Caleb Downs 45 Yd Interception Return",
      }
    );
    assert.equal(clip.demo, false);
    assert.equal(clip.match?.id, "osuTexHL");
    assert.equal(clip.emptyHeadline, null);
  });

  it("still matches when ESPN shortName is the abbreviation (OSU / TEX)", () => {
    const clip = clipLookupForGame(
      [
        video({
          id: "osuTexHL",
          title: "Ohio State vs Texas | Full Game Highlights",
        }),
      ],
      {
        league: "cfb",
        away: { name: "Ohio State Buckeyes", shortName: "OSU", abbreviation: "OSU" },
        home: { name: "Texas Longhorns", shortName: "TEX", abbreviation: "TEX" },
        playText: "Connor Hawkins 26 Yd Field Goal",
      }
    );
    assert.equal(clip.match?.id, "osuTexHL");
    assert.equal(clip.demo, false);
  });
});
