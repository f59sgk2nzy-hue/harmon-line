import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleHighlights,
  classifyVideoKind,
  currentCfbSeasonYear,
  isCurrentSeasonVideo,
  mixHighlightFeed,
  parseYoutubeAtom,
  sampleHighlightVideos,
  youtubeThumbnailUrl,
} from "./youtube";

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>ESPN College Football</title>
 <entry>
  <yt:videoId>-SdWqIGScPQ</yt:videoId>
  <title>Reacting to Oklahoma's season-altering loss to Michigan</title>
  <author><name>ESPN College Football</name></author>
  <published>2026-09-13T14:30:02+00:00</published>
  <media:group>
   <media:thumbnail url="https://i2.ytimg.com/vi/-SdWqIGScPQ/hqdefault.jpg" width="480" height="360"/>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>abc123HIGH</yt:videoId>
  <title>Arkansas Razorbacks vs. Utah Utes | Full Game Highlights</title>
  <author><name>ESPN College Football</name></author>
  <published>2026-09-13T12:00:00+00:00</published>
  <media:group>
   <media:thumbnail url="https://i.ytimg.com/vi/abc123HIGH/hqdefault.jpg"/>
  </media:group>
 </entry>
</feed>`;

describe("parseYoutubeAtom", () => {
  it("reads video id, title, channel, published time, and thumbnail from Atom RSS", () => {
    const videos = parseYoutubeAtom(SAMPLE_ATOM, "highlight");
    assert.equal(videos.length, 2);
    assert.equal(videos[0]?.id, "-SdWqIGScPQ");
    assert.equal(videos[0]?.channel, "ESPN College Football");
    assert.equal(videos[0]?.publishedAt, "2026-09-13T14:30:02+00:00");
    assert.equal(
      videos[0]?.thumbnailUrl,
      "https://i2.ytimg.com/vi/-SdWqIGScPQ/hqdefault.jpg"
    );
    assert.equal(videos[0]?.watchUrl, "https://www.youtube.com/watch?v=-SdWqIGScPQ");
    assert.equal(videos[0]?.sample, false);
  });

  it("returns an empty list for junk XML instead of inventing videos", () => {
    assert.deepEqual(parseYoutubeAtom("<html>nope</html>"), []);
    assert.deepEqual(parseYoutubeAtom(""), []);
  });
});

describe("classifyVideoKind", () => {
  it("labels reaction titles as reaction even on a highlight channel", () => {
    assert.equal(
      classifyVideoKind("Reacting to Oklahoma's loss", "highlight"),
      "reaction"
    );
  });

  it("labels highlight titles as highlight even on a reaction channel", () => {
    assert.equal(
      classifyVideoKind("Full Game Highlights: Alabama vs Georgia", "reaction"),
      "highlight"
    );
  });

  it("falls back to the channel kind when the title is ambiguous", () => {
    assert.equal(classifyVideoKind("Week 2 College Football Rankings", "highlight"), "highlight");
    assert.equal(classifyVideoKind("Week 2 College Football Rankings", "reaction"), "reaction");
  });
});

describe("currentCfbSeasonYear", () => {
  it("uses the calendar year during the fall season", () => {
    assert.equal(currentCfbSeasonYear(new Date("2026-09-13T18:00:00.000Z")), 2026);
  });

  it("keeps January bowl games on the previous fall season", () => {
    assert.equal(currentCfbSeasonYear(new Date("2027-01-12T18:00:00.000Z")), 2026);
  });
});

describe("isCurrentSeasonVideo", () => {
  it("keeps September 2026 uploads for the 2026 season", () => {
    assert.equal(isCurrentSeasonVideo("2026-09-13T12:00:00.000Z", 2026), true);
  });

  it("drops a stale 2024 highlight from the 2026 board", () => {
    assert.equal(isCurrentSeasonVideo("2024-11-02T12:00:00.000Z", 2026), false);
  });
});

describe("mixHighlightFeed", () => {
  it("interleaves highlights and reactions and drops duplicate ids", () => {
    const mixed = mixHighlightFeed(
      [
        {
          id: "h1",
          title: "Game Highlights",
          channel: "ESPN",
          publishedAt: "2026-09-13T12:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/h1/hqdefault.jpg",
          watchUrl: "https://www.youtube.com/watch?v=h1",
          kind: "highlight",
          sample: false,
        },
        {
          id: "h1",
          title: "Game Highlights (dup)",
          channel: "ESPN",
          publishedAt: "2026-09-13T12:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/h1/hqdefault.jpg",
          watchUrl: "https://www.youtube.com/watch?v=h1",
          kind: "highlight",
          sample: false,
        },
        {
          id: "r1",
          title: "Instant reaction",
          channel: "Cover 3",
          publishedAt: "2026-09-13T13:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/r1/hqdefault.jpg",
          watchUrl: "https://www.youtube.com/watch?v=r1",
          kind: "reaction",
          sample: false,
        },
        {
          id: "h2",
          title: "Big play",
          channel: "FOX",
          publishedAt: "2026-09-13T11:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/h2/hqdefault.jpg",
          watchUrl: "https://www.youtube.com/watch?v=h2",
          kind: "highlight",
          sample: false,
        },
      ],
      4
    );
    assert.deepEqual(
      mixed.map((v) => v.id),
      ["r1", "h1", "h2"]
    );
    assert.equal(mixed[0]?.kind, "reaction");
    assert.equal(mixed[1]?.kind, "highlight");
  });
});

describe("assembleHighlights", () => {
  it("builds a live RSS response and never marks it as sample scores", () => {
    const board = assembleHighlights({
      rssVideos: parseYoutubeAtom(SAMPLE_ATOM, "highlight"),
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.sample, false);
    assert.equal(board.source, "youtube-rss");
    assert.equal(board.seasonYear, 2026);
    assert.ok(board.videos.length >= 2);
    assert.ok(board.videos.every((v) => v.sample === false));
    assert.ok(board.videos.some((v) => v.kind === "highlight"));
    assert.ok(board.videos.some((v) => v.kind === "reaction"));
  });

  it("uses SAMPLE-labeled cards only when no live videos arrive", () => {
    const board = assembleHighlights({
      rssVideos: [],
      apiVideos: [],
      apiKeyConfigured: false,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.sample, true);
    assert.equal(board.source, "sample");
    assert.ok(board.videos.length > 0);
    assert.ok(board.videos.every((v) => v.sample && v.title.startsWith("SAMPLE")));
  });

  it("prefers Data API videos when a key is configured and results exist", () => {
    const apiVideos = [
      {
        id: "api1",
        title: "College football highlights 2026",
        channel: "Search",
        publishedAt: "2026-09-13T10:00:00.000Z",
        thumbnailUrl: youtubeThumbnailUrl("api1"),
        watchUrl: "https://www.youtube.com/watch?v=api1",
        kind: "highlight" as const,
        sample: false,
      },
    ];
    const board = assembleHighlights({
      rssVideos: parseYoutubeAtom(SAMPLE_ATOM, "highlight"),
      apiVideos,
      apiKeyConfigured: true,
      now: new Date("2026-09-13T18:00:00.000Z"),
    });
    assert.equal(board.sample, false);
    assert.equal(board.source, "mixed");
    assert.ok(board.videos.some((v) => v.id === "api1"));
  });
});

describe("sampleHighlightVideos", () => {
  it("never pretends SAMPLE cards are live scores", () => {
    const cards = sampleHighlightVideos(2026);
    assert.ok(cards.every((v) => v.sample));
    assert.ok(cards.every((v) => v.title.includes("SAMPLE")));
    assert.ok(cards.some((v) => v.kind === "highlight"));
    assert.ok(cards.some((v) => v.kind === "reaction"));
  });
});
