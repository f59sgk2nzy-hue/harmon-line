import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_KEY_ENVS,
  geminiApiKey,
  geminiConfigured,
  geminiModel,
  parseGeminiGroundingResponse,
  buildGeminiGenerateRequest,
  createGeminiGroundingClient,
} from "./gemini-grounding";

const FINALS_1974_PAYLOAD = {
  candidates: [
    {
      content: {
        role: "model",
        parts: [
          {
            text: "The Boston Celtics won the 1974 NBA Finals, defeating the Milwaukee Bucks 4-3.",
          },
        ],
      },
      groundingMetadata: {
        webSearchQueries: ["who won the 1974 NBA Finals", "1974 NBA Finals champion"],
        groundingChunks: [
          {
            web: {
              uri: "https://www.nba.com/news/history-finals-1974",
              title: "1974 NBA Finals — NBA.com",
            },
          },
          {
            web: {
              uri: "https://www.basketball-reference.com/playoffs/1974-nba-finals-bucks-vs-celtics.html",
              title: "1974 NBA Finals Bucks vs Celtics | Basketball-Reference",
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              startIndex: 0,
              endIndex: 48,
              text: "The Boston Celtics won the 1974 NBA Finals",
            },
            groundingChunkIndices: [0, 1],
          },
        ],
      },
    },
  ],
};

describe("geminiApiKey / geminiConfigured", () => {
  it("reads GOOGLE_GENERATIVE_AI_API_KEY first, then GOOGLE_API_KEY, then GEMINI_API_KEY", () => {
    assert.deepEqual(GEMINI_KEY_ENVS, [
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_API_KEY",
      "GEMINI_API_KEY",
    ]);
    assert.equal(
      geminiApiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "gen-ai", GOOGLE_API_KEY: "google", GEMINI_API_KEY: "gemini" }),
      "gen-ai"
    );
    assert.equal(geminiApiKey({ GOOGLE_API_KEY: "google", GEMINI_API_KEY: "gemini" }), "google");
    assert.equal(geminiApiKey({ GEMINI_API_KEY: "gemini" }), "gemini");
    assert.equal(geminiApiKey({ GOOGLE_GENERATIVE_AI_API_KEY: "  " }), null);
    assert.equal(geminiApiKey({}), null);
    assert.equal(geminiConfigured({ GEMINI_API_KEY: "gemini" }), true);
    assert.equal(geminiConfigured({}), false);
  });

  it("does not require a Custom Search Engine id", () => {
    assert.equal(geminiConfigured({ GEMINI_API_KEY: "gemini", GOOGLE_CSE_ID: undefined }), true);
    assert.ok(!GEMINI_KEY_ENVS.includes("GOOGLE_CSE_ID" as (typeof GEMINI_KEY_ENVS)[number]));
  });

  it("uses GEMINI_MODEL when set, otherwise the default flash model", () => {
    assert.equal(geminiModel({}), DEFAULT_GEMINI_MODEL);
    assert.equal(geminiModel({ GEMINI_MODEL: "gemini-2.0-flash" }), "gemini-2.0-flash");
  });
});

describe("parseGeminiGroundingResponse", () => {
  it("maps Google grounding metadata into citations, snippets, and model text", () => {
    const parsed = parseGeminiGroundingResponse(FINALS_1974_PAYLOAD);
    assert.equal(parsed.grounded, true);
    assert.match(parsed.text, /Boston Celtics/i);
    assert.equal(parsed.citations.length, 2);
    assert.ok(parsed.citations.some((row) => /nba\.com/i.test(row.uri)));
    assert.ok(parsed.citations.some((row) => /basketball-reference/i.test(row.uri)));
    assert.ok(parsed.citations.some((row) => /Boston Celtics/i.test(row.snippet ?? "")));
    assert.ok(parsed.webSearchQueries.some((q) => /1974/i.test(q)));
  });

  it("reads snake_case grounding_metadata used by some REST payloads", () => {
    const parsed = parseGeminiGroundingResponse({
      candidates: [
        {
          content: { parts: [{ text: "Spain won Euro 2024." }] },
          grounding_metadata: {
            web_search_queries: ["UEFA Euro 2024 winner"],
            grounding_chunks: [{ web: { uri: "https://www.uefa.com/euro2024", title: "uefa.com" } }],
            grounding_supports: [
              {
                segment: { text: "Spain won Euro 2024." },
                grounding_chunk_indices: [0],
              },
            ],
          },
        },
      ],
    });
    assert.equal(parsed.grounded, true);
    assert.equal(parsed.citations[0]?.uri, "https://www.uefa.com/euro2024");
    assert.match(parsed.citations[0]?.snippet ?? "", /Spain won Euro 2024/i);
  });

  it("marks ungrounded synthesis when there are no citation URLs", () => {
    const parsed = parseGeminiGroundingResponse({
      candidates: [{ content: { parts: [{ text: "I think the Celtics probably won." }] } }],
    });
    assert.equal(parsed.grounded, false);
    assert.deepEqual(parsed.citations, []);
    assert.match(parsed.text, /probably/i);
  });

  it("returns empty text instead of inventing an answer on junk payloads", () => {
    assert.equal(parseGeminiGroundingResponse(null).text, "");
    assert.equal(parseGeminiGroundingResponse({}).grounded, false);
    assert.equal(parseGeminiGroundingResponse({ candidates: [] }).citations.length, 0);
  });
});

describe("buildGeminiGenerateRequest", () => {
  it("enables the google_search tool and never a Custom Search Engine", () => {
    const body = buildGeminiGenerateRequest("Who won the 1974 NBA Finals?");
    assert.ok(Array.isArray(body.tools));
    assert.ok(body.tools.some((tool) => tool.google_search && Object.keys(tool).includes("google_search")));
    const blob = JSON.stringify(body);
    assert.doesNotMatch(blob, /customsearch\.googleapis|cse\.google\.com|&cx=/i);
    assert.match(blob, /1974 NBA Finals/);
    assert.match(blob, /never invent/i);
  });
});

describe("createGeminiGroundingClient", () => {
  it("posts generateContent with google_search and the Gemini API key header, never a CSE id", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createGeminiGroundingClient({
      env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-2.5-flash" },
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify(FINALS_1974_PAYLOAD), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    assert.ok(client);
    const result = await client!.generate("Who won the 1974 NBA Finals?");
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/);
    assert.doesNotMatch(calls[0]?.url ?? "", /customsearch|cse|cx=/i);
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(headers.get("x-goog-api-key"), "test-key");
    const body = JSON.parse(String(calls[0]?.init.body ?? "{}"));
    assert.ok(body.tools?.[0]?.google_search);
    assert.match(result.text, /Boston Celtics/i);
    assert.equal(result.grounded, true);
  });
});
