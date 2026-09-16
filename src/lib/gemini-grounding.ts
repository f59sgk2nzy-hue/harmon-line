export const GEMINI_KEY_ENVS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
export const GEMINI_GENERATE_PATH = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_FETCH_TIMEOUT_MS = 20_000;

export type GeminiGroundingCitation = {
  title: string;
  uri: string;
  snippet: string | null;
};

export type GeminiGroundingResult = {
  text: string;
  citations: GeminiGroundingCitation[];
  webSearchQueries: string[];
  grounded: boolean;
};

export type GeminiGenerateRequest = {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: "user"; parts: Array<{ text: string }> }>;
  tools: Array<{ google_search: Record<string, never> }>;
  generationConfig: { temperature: number };
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function pick(record: Json | null, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] != null) return record[key];
  }
  return undefined;
}

function processGeminiEnv(): Record<string, string | undefined> {
  return {
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };
}

export function geminiApiKey(env: Record<string, string | undefined> = processGeminiEnv()): string | null {
  const keys = [
    env.GOOGLE_GENERATIVE_AI_API_KEY,
    env.GOOGLE_API_KEY,
    env.GEMINI_API_KEY,
  ];
  for (const value of keys) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function geminiConfigured(env: Record<string, string | undefined> = processGeminiEnv()): boolean {
  return Boolean(geminiApiKey(env));
}

export function geminiModel(env: Record<string, string | undefined> = processGeminiEnv()): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export const GEMINI_SYSTEM_INSTRUCTION = [
  "You are Stat Oracle on The Harmon Line, a nostalgic ESPN-style sports scoreboard.",
  "Answer sports questions using Google Search grounding.",
  "Never invent scores, champions, records, dates, sample sizes, percentiles, or video ids.",
  "If search results do not support a claim, say you cannot confirm it from grounded sources.",
  "Do not give betting advice, ATS, spreads, moneylines, over/unders, parlays, or odds.",
  "Prefer official league, team, encyclopedia, or reputable news sources.",
  "Be concise: lead with the factual answer, then one supporting sentence.",
].join(" ");

export function buildGeminiGenerateRequest(question: string): GeminiGenerateRequest {
  return {
    systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [{ text: question.trim() }],
      },
    ],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 },
  };
}

function citationKey(uri: string, title: string): string {
  return `${uri.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function webFromChunk(chunk: unknown): { uri: string; title: string } | null {
  const rec = asRecord(chunk);
  const web = asRecord(pick(rec, "web", "retrievedContext", "retrieved_context"));
  const uri = str(pick(web, "uri", "url"));
  if (!uri) return null;
  const title = str(pick(web, "title"), uri);
  return { uri, title };
}

function snippetForChunk(
  index: number,
  supports: unknown[],
  fallback: string | null
): string | null {
  for (const support of supports) {
    const rec = asRecord(support);
    const indices = asArray(pick(rec, "groundingChunkIndices", "grounding_chunk_indices")).map((n) =>
      typeof n === "number" ? n : Number(n)
    );
    if (!indices.includes(index)) continue;
    const segment = asRecord(pick(rec, "segment"));
    const text = str(pick(segment, "text")).trim();
    if (text) return text;
  }
  return fallback;
}

export function parseGeminiGroundingResponse(payload: unknown): GeminiGroundingResult {
  const root = asRecord(payload);
  const candidate = asRecord(asArray(pick(root, "candidates"))[0]);
  const content = asRecord(pick(candidate, "content"));
  const parts = asArray(pick(content, "parts"));
  const text = parts
    .map((part) => str(pick(asRecord(part), "text")))
    .join("\n")
    .trim();

  const metadata = asRecord(
    pick(candidate, "groundingMetadata", "grounding_metadata")
  );
  const chunks = asArray(pick(metadata, "groundingChunks", "grounding_chunks"));
  const supports = asArray(pick(metadata, "groundingSupports", "grounding_supports"));
  const queries = asArray(pick(metadata, "webSearchQueries", "web_search_queries"))
    .map((row) => str(row).trim())
    .filter(Boolean);

  const citations: GeminiGroundingCitation[] = [];
  const seen = new Set<string>();
  chunks.forEach((chunk, index) => {
    const web = webFromChunk(chunk);
    if (!web) return;
    const key = citationKey(web.uri, web.title);
    if (seen.has(key)) return;
    seen.add(key);
    citations.push({
      title: web.title,
      uri: web.uri,
      snippet: snippetForChunk(index, supports, text || null),
    });
  });

  const attributions = asArray(
    pick(metadata, "groundingAttributions", "grounding_attributions")
  );
  for (const row of attributions) {
    const web = webFromChunk(row);
    if (!web) continue;
    const key = citationKey(web.uri, web.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = asRecord(row);
    const segment = asRecord(pick(rec, "segment"));
    citations.push({
      title: web.title,
      uri: web.uri,
      snippet: str(pick(segment, "text")).trim() || text || null,
    });
  }

  return {
    text,
    citations,
    webSearchQueries: queries,
    grounded: citations.some((row) => Boolean(row.uri)),
  };
}

export function evidenceLinesFromCitations(citations: GeminiGroundingCitation[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const citation of citations) {
    const snippet = citation.snippet?.trim();
    const line = snippet
      ? `${snippet} — ${citation.title} (${citation.uri})`
      : `${citation.title} (${citation.uri})`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

export type GeminiFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type GeminiGroundingClient = {
  generate: (question: string) => Promise<GeminiGroundingResult>;
};

function modelCandidates(env: Record<string, string | undefined>): string[] {
  const preferred = geminiModel(env);
  const rest = GEMINI_MODEL_FALLBACKS.filter((name) => name !== preferred);
  return [preferred, ...rest];
}

async function postGenerate(options: {
  model: string;
  key: string;
  body: GeminiGenerateRequest;
  fetchFn: GeminiFetch;
}): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);
  try {
    const response = await options.fetchFn(
      `${GEMINI_GENERATE_PATH}/${options.model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-goog-api-key": options.key,
        },
        body: JSON.stringify(options.body),
        cache: "no-store",
      }
    );
    const payload: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

export function createGeminiGroundingClient(options?: {
  env?: Record<string, string | undefined>;
  fetchFn?: GeminiFetch;
}): GeminiGroundingClient | null {
  const env = options?.env ?? processGeminiEnv();
  const key = geminiApiKey(env);
  if (!key) return null;
  const fetchFn: GeminiFetch = options?.fetchFn ?? ((input, init) => fetch(input, init));

  return {
    generate: async (question: string) => {
      const body = buildGeminiGenerateRequest(question);
      let lastError = "Gemini generateContent failed";
      for (const model of modelCandidates(env)) {
        const result = await postGenerate({ model, key, body, fetchFn });
        if (result.ok) return parseGeminiGroundingResponse(result.payload);
        if (result.status === 404) {
          lastError = `Gemini model ${model} was not found`;
          continue;
        }
        const err = asRecord(asRecord(result.payload)?.error);
        lastError = str(err?.message, `Gemini generateContent HTTP ${result.status}`);
        throw new Error(lastError);
      }
      throw new Error(lastError);
    },
  };
}
