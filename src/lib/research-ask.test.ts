import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sportResearchAskHref } from "./board-url";
import {
  answerResearchAsk,
  googleSearchConfigured,
  parseGoogleCseItems,
  type GoogleSearchClient,
  type GoogleSearchHit,
} from "./research-ask";

const FORBIDDEN = /pnl|polymarket|monte.?carlo|winprob|pickcenter|\bats\b|paid.?odds|\bwpa\b/i;

const OSU_HIT: GoogleSearchHit = {
  title: "Ohio State vs Texas - Game Recap",
  href: "https://www.espn.com/college-football/recap/_/id/401856682",
  snippet: "Ohio State beat Texas 24-21 in Austin. Julian Sayin threw two touchdowns.",
  displayLink: "www.espn.com",
};

const RANK_HIT: GoogleSearchHit = {
  title: "AP Top 25: Alabama ranked No. 4",
  href: "https://www.espn.com/college-football/rankings",
  snippet: "Alabama is listed at No. 4 in the AP Top 25 after week 3.",
  displayLink: "www.espn.com",
};

function client(options: {
  configured?: boolean;
  hits?: GoogleSearchHit[];
  error?: Error;
  onSearch?: (query: string) => void;
}): GoogleSearchClient {
  return {
    configured: options.configured ?? true,
    search: async (query) => {
      options.onSearch?.(query);
      if (options.error) throw options.error;
      return options.hits ?? [];
    },
  };
}

describe("googleSearchConfigured", () => {
  it("is false when GOOGLE_API_KEY or CSE id is missing", () => {
    assert.equal(googleSearchConfigured({}), false);
    assert.equal(googleSearchConfigured({ GOOGLE_API_KEY: "k" }), false);
    assert.equal(googleSearchConfigured({ GOOGLE_CSE_ID: "cx" }), false);
    assert.equal(googleSearchConfigured({ GOOGLE_SEARCH_ENGINE_ID: "cx" }), false);
    assert.equal(googleSearchConfigured({ GOOGLE_API_KEY: "  ", GOOGLE_CSE_ID: "cx" }), false);
  });

  it("accepts GOOGLE_CSE_ID or GOOGLE_SEARCH_ENGINE_ID with GOOGLE_API_KEY", () => {
    assert.equal(googleSearchConfigured({ GOOGLE_API_KEY: "k", GOOGLE_CSE_ID: "cx" }), true);
    assert.equal(
      googleSearchConfigured({ GOOGLE_API_KEY: "k", GOOGLE_SEARCH_ENGINE_ID: "cx" }),
      true
    );
  });
});

describe("parseGoogleCseItems", () => {
  it("copies title, link, and snippet from Custom Search items", () => {
    const items = parseGoogleCseItems({
      items: [
        {
          title: "Ohio State vs Texas - Game Recap",
          link: "https://www.espn.com/college-football/recap/_/id/401856682",
          snippet: "Ohio State beat Texas 24-21 in Austin.",
          displayLink: "www.espn.com",
        },
        { title: "  ", link: "https://example.com", snippet: "skip blank title" },
        { title: "No link", snippet: "skip" },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Ohio State vs Texas - Game Recap");
    assert.equal(items[0]?.href, "https://www.espn.com/college-football/recap/_/id/401856682");
    assert.match(items[0]?.snippet ?? "", /24-21/);
    assert.equal(items[0]?.displayLink, "www.espn.com");
  });

  it("returns [] for junk payloads instead of inventing SAMPLE results", () => {
    assert.deepEqual(parseGoogleCseItems(null), []);
    assert.deepEqual(parseGoogleCseItems({}), []);
    assert.deepEqual(parseGoogleCseItems({ items: "nope" }), []);
    assert.deepEqual(parseGoogleCseItems({ items: [{ sample: true, title: "FAKE" }] }), []);
  });
});

describe("sportResearchAskHref", () => {
  it("keeps CFB research ask at /research and preserves league plus question", () => {
    assert.equal(sportResearchAskHref("cfb"), "/research");
    assert.equal(sportResearchAskHref("mbb"), "/research?league=mbb");
    assert.equal(
      sportResearchAskHref("nba", "Lakers vs Celtics"),
      "/research?league=nba&q=Lakers+vs+Celtics"
    );
  });
});

describe("answerResearchAsk", () => {
  it("returns GOOGLE SEARCH NOT CONFIGURED with demo false and never invents sources", async () => {
    let called = 0;
    const result = await answerResearchAsk(
      { q: "Ohio State vs Texas recap" },
      client({
        configured: false,
        hits: [OSU_HIT],
        onSearch: () => {
          called += 1;
        },
      })
    );
    assert.equal(result.demo, false);
    assert.equal(result.configured, false);
    assert.equal(result.scope, "unconfigured");
    assert.equal(result.honesty.headline, "GOOGLE SEARCH NOT CONFIGURED");
    assert.match(result.honesty.detail, /not on this feed/i);
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.sources, []);
    assert.equal(called, 0);
    assert.doesNotMatch(JSON.stringify(result.sources), /espn\.com|24-21|SAMPLE/i);
    assert.doesNotMatch(result.evidence.join("\n"), /espn\.com|24-21|SAMPLE/i);
    assert.doesNotMatch(result.evidence.join("\n"), FORBIDDEN);
    assert.doesNotMatch(JSON.stringify(result.sources), FORBIDDEN);
  });

  it("copies Evidence from observed Google titles/snippets/links and labels Inference SIMULATION", async () => {
    const result = await answerResearchAsk(
      { q: "Ohio State vs Texas recap", league: "cfb" },
      client({ hits: [OSU_HIT, RANK_HIT] })
    );
    assert.equal(result.demo, false);
    assert.equal(result.source, "google-cse");
    assert.equal(result.configured, true);
    assert.equal(result.scope, "google");
    assert.equal(result.simulation, true);
    assert.ok(result.evidence.length >= 2);
    assert.match(result.evidence.join("\n"), /Ohio State beat Texas 24-21/);
    assert.match(result.evidence.join("\n"), /Alabama is listed at No\. 4/);
    assert.ok(result.inference.some((line) => /SIMULATION/i.test(line)));
    assert.ok(result.inference.every((line) => /INFERENCE|SIMULATION/i.test(line)));
    assert.equal(result.sources[0]?.href, OSU_HIT.href);
    assert.equal(result.sources[1]?.href, RANK_HIT.href);
    assert.match(result.answerMarkdown, /Evidence/i);
    assert.match(result.answerMarkdown, /Inference/i);
    assert.doesNotMatch(result.evidence.join("\n"), FORBIDDEN);
    assert.doesNotMatch(JSON.stringify(result.sources), FORBIDDEN);
  });

  it("does not invent scores, WPA, or odds when Google snippets omit them", async () => {
    const result = await answerResearchAsk(
      { q: "Who won Boise State vs Air Force?" },
      client({
        hits: [
          {
            title: "Mountain West notebook",
            href: "https://www.espn.com/college-football/story/_/id/preview",
            snippet: "Boise State and Air Force meet Saturday in Boise. Kickoff is set for the evening window.",
            displayLink: "www.espn.com",
          },
        ],
      })
    );
    const observed = `${result.evidence.join(" ")} ${result.sources.map((src) => src.snippet).join(" ")}`;
    assert.doesNotMatch(observed, /\b\d{1,2}-\d{1,2}\b/);
    assert.doesNotMatch(observed, FORBIDDEN);
    assert.doesNotMatch(observed, /\b0-0\b|\b0–0\b/);
    assert.doesNotMatch(result.inference.join("\n"), /\b\d{1,2}-\d{1,2}\b/);
    assert.match(result.inference.join("\n"), /SIMULATION/i);
  });

  it("refuses betting/ATS/spreads like Oracle and does not call Google", async () => {
    let called = 0;
    const result = await answerResearchAsk(
      { q: "Does Ohio State cover the spread ATS?" },
      client({
        hits: [OSU_HIT],
        onSearch: () => {
          called += 1;
        },
      })
    );
    assert.equal(result.scope, "refused");
    assert.equal(result.demo, false);
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.sources, []);
    assert.equal(called, 0);
    assert.match(result.inference.join("\n"), /refus|not give betting|no betting advice/i);
    assert.ok(result.rgDisclaimer);
    assert.match(result.rgDisclaimer, /1-800-GAMBLER/);
    assert.equal(result.honesty.headline, "BETTING ADVICE REFUSED");
    assert.doesNotMatch(result.evidence.join("\n"), FORBIDDEN);
    assert.doesNotMatch(JSON.stringify(result.sources), FORBIDDEN);
    assert.doesNotMatch(result.inference.join("\n"), /polymarket|pickcenter|winprob/i);
  });

  it("returns an honest empty when Google items are missing — never SAMPLE sources", async () => {
    const result = await answerResearchAsk(
      { q: "Obscure NAIA final that is not indexed" },
      client({ hits: [] })
    );
    assert.equal(result.scope, "empty");
    assert.equal(result.demo, false);
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.sources, []);
    assert.match(result.honesty.headline, /NOT ON THIS FEED/i);
    assert.doesNotMatch(JSON.stringify(result.sources), /SAMPLE/i);
    assert.doesNotMatch(result.evidence.join("\n"), /SAMPLE/i);
  });

  it("does not invent sources when the Custom Search request fails", async () => {
    const result = await answerResearchAsk(
      { q: "Ohio State vs Texas recap" },
      client({ error: new Error("Google 403") })
    );
    assert.equal(result.scope, "empty");
    assert.equal(result.demo, false);
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.sources, []);
    assert.match(result.honesty.detail, /never invent/i);
  });

  it("does not invent an answer when the question is empty", async () => {
    const result = await answerResearchAsk({ q: "   " }, client({ hits: [OSU_HIT] }));
    assert.equal(result.scope, "empty");
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.sources, []);
  });
});
