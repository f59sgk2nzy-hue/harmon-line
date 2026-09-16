import { isBettingQuestion } from "@/lib/betting";
import { parseLeagueParam } from "@/lib/leagues";
import { BETTING_DISCLAIMER_LONG } from "@/lib/sim";
import type { LeagueId } from "@/lib/types";

export const RESEARCH_ASK_VERSION = "google-research-ask-v0";
const SEARCH_TIMEOUT_MS = 10_000;
const SEARCH_LIMIT = 8;
const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export type GoogleSearchHit = {
  title: string;
  href: string;
  snippet: string;
  displayLink: string | null;
};

export type GoogleSearchClient = {
  configured: boolean;
  search: (query: string) => Promise<GoogleSearchHit[]>;
};

export type ResearchAskScope = "google" | "empty" | "refused" | "unconfigured";

export type ResearchAskHonesty = {
  headline: string;
  detail: string;
};

export type ResearchAskResponse = {
  source: "google-cse" | "none";
  demo: false;
  query: string;
  league: LeagueId;
  generatedAt: string;
  configured: boolean;
  scope: ResearchAskScope;
  honesty: ResearchAskHonesty;
  evidence: string[];
  inference: string[];
  answerMarkdown: string;
  sources: GoogleSearchHit[];
  rgDisclaimer: string | null;
  simulation: boolean;
};

function googleKey(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  return env.GOOGLE_API_KEY?.trim() ?? "";
}

function googleCx(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  return (env.GOOGLE_CSE_ID ?? env.GOOGLE_SEARCH_ENGINE_ID)?.trim() ?? "";
}

export function googleSearchConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return Boolean(googleKey(env) && googleCx(env));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseGoogleCseItems(payload: unknown): GoogleSearchHit[] {
  const record = asRecord(payload);
  if (!record) return [];
  const hits: GoogleSearchHit[] = [];
  for (const entry of asArray(record.items)) {
    const item = asRecord(entry);
    if (!item) continue;
    const title = firstString(item.title);
    const href = firstString(item.link);
    const snippet = firstString(item.snippet);
    if (!title || !href || !isHttpHref(href)) continue;
    hits.push({
      title,
      href,
      snippet,
      displayLink: firstString(item.displayLink) || null,
    });
  }
  return hits;
}

async function fetchGoogleCse(query: string, key: string, cx: string): Promise<GoogleSearchHit[]> {
  const url = new URL(GOOGLE_CSE_ENDPOINT);
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(SEARCH_LIMIT));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Google CSE ${response.status}`);
    }
    return parseGoogleCseItems(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export function createGoogleSearchClient(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): GoogleSearchClient {
  const configured = googleSearchConfigured(env);
  return {
    configured,
    search: async (query) => {
      if (!configured) return [];
      return fetchGoogleCse(query, googleKey(env), googleCx(env));
    },
  };
}

function markdown(evidence: string[], inference: string[]): string {
  const ev =
    evidence.length > 0
      ? evidence.map((line) => `- ${line}`).join("\n")
      : "- None. Google did not return result snippets for this question.";
  const inf =
    inference.length > 0
      ? inference.map((line) => `- ${line}`).join("\n")
      : "- No inference. Missing data stays blank — never invented.";
  return `**Evidence** (observed from Google result snippets/titles/links — never invented)\n\n${ev}\n\n**Inference** (model synthesis, labeled SIMULATION — not a live score)\n\n${inf}\n\n_Research ask v0 reads Google Programmable Search snippets. It does not invent scores, WPA, or odds._`;
}

function evidenceLines(hits: GoogleSearchHit[]): string[] {
  return hits.map((hit) => {
    const snippet = hit.snippet ? ` — ${hit.snippet}` : "";
    return `${hit.title}${snippet}`;
  });
}

function synthesizeInference(query: string, hits: GoogleSearchHit[]): string[] {
  if (hits.length === 0) {
    return [
      "INFERENCE (SIMULATION): Google did not return snippets for this question. Scores, WPA, and odds are never invented.",
    ];
  }
  const observed = hits
    .map((hit) => hit.snippet || hit.title)
    .filter(Boolean)
    .slice(0, 3);
  return [
    `INFERENCE (SIMULATION): Restating observed Google snippets for “${query}”: ${observed.join(" ")}`,
    "INFERENCE (SIMULATION): This synthesis copies Google titles/snippets only. It is not a live scoreboard cell, WPA, or Harmon Line price.",
  ];
}

function baseAnswer(options: {
  query: string;
  league: LeagueId;
  generatedAt: string;
  configured: boolean;
  scope: ResearchAskScope;
  honesty: ResearchAskHonesty;
  evidence?: string[];
  inference: string[];
  sources?: GoogleSearchHit[];
  rgDisclaimer?: string | null;
  simulation?: boolean;
  source?: ResearchAskResponse["source"];
}): ResearchAskResponse {
  const evidence = options.evidence ?? [];
  const inference = options.inference;
  return {
    source: options.source ?? "none",
    demo: false,
    query: options.query,
    league: options.league,
    generatedAt: options.generatedAt,
    configured: options.configured,
    scope: options.scope,
    honesty: options.honesty,
    evidence,
    inference,
    answerMarkdown: markdown(evidence, inference),
    sources: options.sources ?? [],
    rgDisclaimer: options.rgDisclaimer ?? null,
    simulation: options.simulation ?? inference.some((line) => /SIMULATION/i.test(line)),
  };
}

export async function answerResearchAsk(
  input: { q: string; league?: LeagueId | string | null },
  search: GoogleSearchClient = createGoogleSearchClient()
): Promise<ResearchAskResponse> {
  const generatedAt = new Date().toISOString();
  const query = (input.q ?? "").trim();
  const league = parseLeagueParam(input.league);

  if (!query) {
    return baseAnswer({
      query: "",
      league,
      generatedAt,
      configured: search.configured,
      scope: "empty",
      honesty: {
        headline: "NOT ON THIS FEED",
        detail:
          "Ask a sports research question. Google result snippets are copied as Evidence. Missing answers stay blank — scores, WPA, and odds are never invented.",
      },
      inference: [
        "INFERENCE (SIMULATION): No question was asked. This panel does not invent sources or stats.",
      ],
    });
  }

  if (isBettingQuestion(query)) {
    return baseAnswer({
      query,
      league,
      generatedAt,
      configured: search.configured,
      scope: "refused",
      honesty: {
        headline: "BETTING ADVICE REFUSED",
        detail:
          "Research ask v0 will not answer betting questions. Ask a published score, recap, or rank question instead.",
      },
      inference: [
        "REFUSED: The Harmon Line does not give betting advice. Ask a sports research question instead.",
      ],
      rgDisclaimer: BETTING_DISCLAIMER_LONG,
    });
  }

  if (!search.configured) {
    return baseAnswer({
      query,
      league,
      generatedAt,
      configured: false,
      scope: "unconfigured",
      honesty: {
        headline: "GOOGLE SEARCH NOT CONFIGURED",
        detail:
          "GOOGLE_API_KEY and GOOGLE_CSE_ID (or GOOGLE_SEARCH_ENGINE_ID) are not set on this feed. Google sources are never invented. This is not on this feed.",
      },
      inference: [
        "INFERENCE (SIMULATION): Google Programmable Search is not configured. Evidence stays empty — scores, WPA, and odds are never invented.",
      ],
    });
  }

  let hits: GoogleSearchHit[] = [];
  try {
    hits = await search.search(query);
  } catch {
    return baseAnswer({
      query,
      league,
      generatedAt,
      configured: true,
      scope: "empty",
      honesty: {
        headline: "NOT ON THIS FEED",
        detail:
          "Google Programmable Search was not reachable. Sources, scores, WPA, and odds are never invented to fill the hole.",
      },
      inference: [
        "INFERENCE (SIMULATION): The Google search request failed. Missing snippets stay blank — never invented.",
      ],
    });
  }

  if (hits.length === 0) {
    return baseAnswer({
      query,
      league,
      generatedAt,
      configured: true,
      scope: "empty",
      honesty: {
        headline: "NOT ON THIS FEED",
        detail:
          "Google Programmable Search returned no result snippets for this question. Sources and stats are never invented.",
      },
      inference: synthesizeInference(query, []),
    });
  }

  const evidence = evidenceLines(hits);
  const inference = synthesizeInference(query, hits);
  return baseAnswer({
    query,
    league,
    generatedAt,
    configured: true,
    scope: "google",
    source: "google-cse",
    honesty: {
      headline: "EVIDENCE FROM GOOGLE RESULT SNIPPETS",
      detail:
        "Evidence is copied from Google Custom Search titles, snippets, and links. Inference is labeled SIMULATION model synthesis, not a live score we created.",
    },
    evidence,
    inference,
    sources: hits,
    simulation: true,
  });
}
