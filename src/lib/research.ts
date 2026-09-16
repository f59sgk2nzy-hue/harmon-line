import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LeagueId } from "./types";

export type ResearchKind = "deep-lore" | "postgame-xray";

export type ResearchSource = {
  label: string;
};

export type ResearchHonesty = {
  headline: string;
  detail: string;
};

export type ResearchBrief = {
  id: string;
  kind: ResearchKind;
  title: string;
  publishedAt: string;
  league: LeagueId | null;
  gameId: string | null;
  sample: boolean;
  evidence: string[];
  inference: string[];
  narrative: string | null;
  simulation: boolean;
  sources: ResearchSource[];
  fileName: string;
};

export type ResearchFeed = {
  source: "disk";
  demo: false;
  generatedAt: string;
  dirs: string[];
  honesty: ResearchHonesty;
  latestDeepLore: ResearchBrief | null;
  xrays: ResearchBrief[];
  briefs: ResearchBrief[];
};

const EMPTY_HEADLINE = "NO BRIEF ON THIS FEED YET";
const EMPTY_DETAIL =
  "Board routines have not dropped a Deep Lore brief or Post-Game X-Ray on this feed. Copy JSON or markdown into public/research/ (or set RESEARCH_DIR). Anomalies and WPA are never invented.";
const LIVE_DETAIL =
  "Read-only briefs from disk. Evidence is copied from the file. Inference is labeled. Model narrative is a SIMULATION, not a live score.";
const SAMPLE_DETAIL =
  "At least one file is a labeled SAMPLE fixture, not a live cron brief. Evidence vs Inference still come from disk — anomalies and WPA are never invented.";

const FORBIDDEN_KEYS = new Set([
  "pnl",
  "polymarket",
  "winprob",
  "winprobability",
  "pickcenter",
  "ats",
  "odds",
  "wpa",
  "montecarlo",
  "paidodds",
]);

const LEAGUES: readonly LeagueId[] = ["cfb", "mbb", "nfl", "nba", "mlb"];

export function defaultResearchDirs(
  options: { cwd?: string; env?: NodeJS.ProcessEnv | Record<string, string | undefined> } = {}
): string[] {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const override = env.RESEARCH_DIR?.trim();
  const primary = override && override.length > 0 ? override : join(cwd, "research");
  const drop = join(cwd, "public", "research");
  if (primary === drop) return [primary];
  return [primary, drop];
}

export function sanitizeResearchId(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  return trimmed;
}

export function getResearchBrief(
  feed: ResearchFeed,
  id: string | null | undefined
): ResearchBrief | null {
  const safe = sanitizeResearchId(id);
  if (!safe) return null;
  return feed.briefs.find((brief) => brief.id === safe) ?? null;
}

export async function loadResearchFeed(
  options: {
    dirs?: string[];
    now?: Date;
    cwd?: string;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  } = {}
): Promise<ResearchFeed> {
  const dirs = options.dirs ?? defaultResearchDirs({ cwd: options.cwd, env: options.env });
  const seen = new Set<string>();
  const loaded: ResearchBrief[] = [];

  for (const dir of dirs) {
    const names = await listFiles(dir);
    for (const name of names) {
      const brief = await readBrief(join(dir, name), name);
      if (!brief) continue;
      if (seen.has(brief.id)) continue;
      seen.add(brief.id);
      loaded.push(brief);
    }
  }

  loaded.sort((a, b) => {
    const byDate = b.publishedAt.localeCompare(a.publishedAt);
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title);
  });

  const latestDeepLore = loaded.find((brief) => brief.kind === "deep-lore") ?? null;
  const xrays = loaded.filter((brief) => brief.kind === "postgame-xray");
  const hasSample = loaded.some((brief) => brief.sample);
  const empty = loaded.length === 0;

  return {
    source: "disk",
    demo: false,
    generatedAt: (options.now ?? new Date()).toISOString(),
    dirs,
    honesty: {
      headline: empty ? EMPTY_HEADLINE : "RESEARCH FEED",
      detail: empty ? EMPTY_DETAIL : hasSample ? SAMPLE_DETAIL : LIVE_DETAIL,
    },
    latestDeepLore,
    xrays,
    briefs: loaded,
  };
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith("."))
      .filter((name) => /\.(json|md|markdown)$/i.test(name))
      .filter((name) => !/^readme\.(md|markdown)$/i.test(name))
      .sort();
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

async function readBrief(path: string, fileName: string): Promise<ResearchBrief | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }

  const parsed = fileName.toLowerCase().endsWith(".json")
    ? parseJsonBrief(raw, fileName)
    : parseMarkdownBrief(raw, fileName);
  if (!parsed) return null;

  let publishedAt = toIso(parsed.publishedAt);
  if (!publishedAt) {
    publishedAt = dateFromFileName(fileName);
  }
  if (!publishedAt) {
    try {
      publishedAt = (await stat(path)).mtime.toISOString();
    } catch {
      publishedAt = new Date(0).toISOString();
    }
  }

  const evidence = parsed.evidence;
  const inference = parsed.inference;
  const narrative = parsed.narrative;
  if (!parsed.title) return null;
  if (!parsed.kind) return null;
  if (evidence.length === 0 && inference.length === 0 && !narrative) return null;

  return {
    id: parsed.id || idFromFileName(fileName),
    kind: parsed.kind,
    title: parsed.title,
    publishedAt,
    league: parsed.league,
    gameId: parsed.gameId,
    sample: parsed.sample || isSampleName(fileName),
    evidence,
    inference,
    narrative,
    simulation: Boolean(narrative) || parsed.simulation,
    sources: parsed.sources,
    fileName,
  };
}

type ParsedStub = {
  id: string;
  kind: ResearchKind | null;
  title: string;
  publishedAt: string | null;
  league: LeagueId | null;
  gameId: string | null;
  sample: boolean;
  evidence: string[];
  inference: string[];
  narrative: string | null;
  simulation: boolean;
  sources: ResearchSource[];
};

function parseJsonBrief(raw: string, fileName: string): ParsedStub | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = kindFrom(record.kind ?? record.type, fileName);
  const evidence = stringList(record.evidence);
  const inference = stringList(record.inference);
  const narrative = firstString(record.narrative ?? record.writeup ?? record.body);
  const title = firstString(record.title) ?? "";
  if (hasForbiddenKeys(record) && evidence.length === 0 && inference.length === 0 && !narrative) {
    return null;
  }
  return {
    id: sanitizeResearchId(firstString(record.id)) || idFromFileName(fileName),
    kind,
    title,
    publishedAt: firstString(record.publishedAt ?? record.date ?? record.published),
    league: optionalLeague(record.league),
    gameId: firstString(record.gameId ?? record.eventId),
    sample: Boolean(record.sample) || isSampleName(fileName),
    evidence,
    inference,
    narrative,
    simulation: record.simulation === true || Boolean(narrative),
    sources: sourceList(record.sources),
  };
}

function parseMarkdownBrief(raw: string, fileName: string): ParsedStub | null {
  const { frontmatter, body } = splitFrontmatter(raw);
  const kind = kindFrom(frontmatter.kind ?? frontmatter.type, fileName);
  const headingTitle = firstHeading(body);
  const sections = markdownSections(body);
  const evidence = stringList(frontmatter.evidence).concat(bullets(sections.evidence));
  const inference = stringList(frontmatter.inference).concat(bullets(sections.inference));
  const narrative =
    firstString(frontmatter.narrative ?? frontmatter.writeup) ??
    prose(sections.narrative) ??
    null;
  return {
    id: sanitizeResearchId(firstString(frontmatter.id)) || idFromFileName(fileName),
    kind,
    title: firstString(frontmatter.title) ?? headingTitle ?? "",
    publishedAt: firstString(frontmatter.publishedAt ?? frontmatter.date ?? frontmatter.published),
    league: optionalLeague(frontmatter.league),
    gameId: firstString(frontmatter.gameId ?? frontmatter.eventId),
    sample:
      frontmatter.sample === "true" ||
      frontmatter.sample === "1" ||
      isSampleName(fileName),
    evidence,
    inference,
    narrative,
    simulation: frontmatter.simulation === "true" || Boolean(narrative),
    sources: [],
  };
}

function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return { frontmatter: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: text };
  const yaml = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\s*\n/, "");
  const frontmatter: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    frontmatter[match[1]] = stripQuotes(match[2].trim());
  }
  return { frontmatter, body };
}

function markdownSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const chunks = body.split(/^##\s+/m);
  for (const chunk of chunks.slice(1)) {
    const newline = chunk.indexOf("\n");
    const heading = (newline === -1 ? chunk : chunk.slice(0, newline)).trim().toLowerCase();
    const content = newline === -1 ? "" : chunk.slice(newline + 1);
    const key = sectionKey(heading);
    if (key) sections[key] = content;
  }
  return sections;
}

function sectionKey(heading: string): "evidence" | "inference" | "narrative" | null {
  if (heading.startsWith("evidence")) return "evidence";
  if (heading.startsWith("inference")) return "inference";
  if (
    heading.startsWith("narrative") ||
    heading.startsWith("writeup") ||
    heading.startsWith("simulation") ||
    heading.startsWith("model")
  ) {
    return "narrative";
  }
  return null;
}

function firstHeading(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function bullets(content: string | undefined): string[] {
  if (!content) return [];
  const items: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*[-*]\s+(.+)/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

function prose(content: string | undefined): string | null {
  if (!content) return null;
  const text = content.trim();
  return text.length > 0 ? text : null;
}

function kindFrom(value: unknown, fileName: string): ResearchKind | null {
  const fromField = normalizeKind(typeof value === "string" ? value : "");
  if (fromField) return fromField;
  const name = fileName.toLowerCase();
  if (name.includes("deep-lore") || name.includes("deep_lore") || name.startsWith("deeplore")) {
    return "deep-lore";
  }
  if (
    name.includes("postgame-xray") ||
    name.includes("postgame_xray") ||
    name.includes("x-ray") ||
    name.includes("xray")
  ) {
    return "postgame-xray";
  }
  return null;
}

function normalizeKind(value: string): ResearchKind | null {
  const kind = value.trim().toLowerCase().replaceAll("_", "-");
  if (kind === "deep-lore" || kind === "deeplore" || kind === "lore") return "deep-lore";
  if (
    kind === "postgame-xray" ||
    kind === "postgame-x-ray" ||
    kind === "x-ray" ||
    kind === "xray" ||
    kind === "postgame"
  ) {
    return "postgame-xray";
  }
  return null;
}

function optionalLeague(value: unknown): LeagueId | null {
  if (typeof value !== "string") return null;
  const league = value.trim().toLowerCase();
  return LEAGUES.includes(league as LeagueId) ? (league as LeagueId) : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function sourceList(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];
  const sources: ResearchSource[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      sources.push({ label: entry.trim() });
      continue;
    }
    if (entry && typeof entry === "object" && "label" in entry) {
      const label = firstString((entry as { label: unknown }).label);
      if (label) sources.push({ label });
    }
  }
  return sources;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = stripQuotes(value.trim());
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function dateFromFileName(fileName: string): string | null {
  const isoDay = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return toIso(`${isoDay[1]}T00:00:00Z`);
  const compact = fileName.match(/(?<!\d)(\d{8})(?!\d)/);
  if (compact) {
    const stamp = compact[1];
    return toIso(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T00:00:00Z`);
  }
  return null;
}

function idFromFileName(fileName: string): string {
  return fileName.replace(/\.(json|md|markdown)$/i, "");
}

function isSampleName(fileName: string): boolean {
  return /\.sample\b|sample\./i.test(fileName) || /(^|[^a-z])sample([^a-z]|$)/i.test(fileName);
}

function hasForbiddenKeys(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => FORBIDDEN_KEYS.has(key.toLowerCase().replaceAll("_", "")));
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
