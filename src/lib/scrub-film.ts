import { parseLeagueParam } from "@/lib/leagues";
import type { LeagueId, LeaderLine, ScoringPlay, TeamSide } from "@/lib/types";
import {
  isYoutubeWatchUrl,
  youtubeSearchUrl,
  type HighlightVideo,
  type HighlightsResponse,
} from "@/lib/youtube";

export const CLIP_EMPTY_HEADLINE = "NO CLIP ON THIS FEED";
export const CLIP_EVIDENCE_LABEL = "Evidence (YouTube feed)";

export type ClipQuery = {
  league: LeagueId;
  awayName?: string | null;
  homeName?: string | null;
  awayAbbr?: string | null;
  homeAbbr?: string | null;
  playText?: string | null;
  playerName?: string | null;
  category?: string | null;
};

export type ClipLookup = {
  demo: false;
  query: string;
  searchUrl: string;
  match: HighlightVideo | null;
  emptyHeadline: typeof CLIP_EMPTY_HEADLINE | null;
  evidenceLabel: typeof CLIP_EVIDENCE_LABEL | null;
};

const PLAY_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "for",
  "from",
  "with",
  "into",
  "over",
  "back",
  "vs",
  "at",
  "in",
  "on",
  "by",
  "yd",
  "yds",
  "yard",
  "yards",
  "pass",
  "rush",
  "run",
  "kick",
  "play",
  "left",
  "right",
  "middle",
  "no",
  "gain",
  "loss",
  "incomplete",
  "penalty",
  "return",
  "extra",
  "point",
  "field",
  "goal",
  "team",
  "game",
  "down",
  "ball",
  "official",
  "review",
  "timeout",
  "clock",
  "quarter",
  "half",
  "period",
  "inning",
  "university",
  "college",
]);

function leagueSearchKeyword(league: LeagueId): string {
  switch (parseLeagueParam(league)) {
    case "mbb":
      return "college basketball";
    case "nfl":
      return "nfl";
    case "nba":
      return "nba";
    case "mlb":
      return "mlb";
    default:
      return "college football";
  }
}

export function normalizeClipText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function teamPhrases(name?: string | null, abbr?: string | null): string[] {
  const phrases: string[] = [];
  const normalized = normalizeClipText(name);
  if (normalized) {
    phrases.push(normalized);
    const parts = normalized.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      phrases.push(parts.slice(0, -1).join(" "));
      phrases.push(parts[parts.length - 1]!);
    }
  }
  const abbreviation = normalizeClipText(abbr);
  if (abbreviation.length >= 2) phrases.push(abbreviation);
  return unique(phrases.filter((phrase) => phrase.length >= 2));
}

function hasPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

function playTokens(query: ClipQuery): string[] {
  const blob = [query.playerName, query.category, query.playText]
    .filter(Boolean)
    .join(" ");
  return unique(
    normalizeClipText(blob)
      .split(" ")
      .filter((word) => word.length >= 4 && !PLAY_STOP.has(word))
  );
}

export function buildClipSearchQuery(query: ClipQuery): string {
  const away = (query.awayName || query.awayAbbr || "").trim();
  const home = (query.homeName || query.homeAbbr || "").trim();
  const play = [query.playerName, query.category, query.playText]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  return [away, away && home ? "vs" : "", home, play, leagueSearchKeyword(query.league), "highlights"]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyClip(query: string, searchUrl: string): ClipLookup {
  return {
    demo: false,
    query,
    searchUrl,
    match: null,
    emptyHeadline: CLIP_EMPTY_HEADLINE,
    evidenceLabel: null,
  };
}

function scoreVideo(video: HighlightVideo, query: ClipQuery): number {
  if (video.sample) return 0;
  if (!isYoutubeWatchUrl(video.watchUrl)) return 0;
  const title = normalizeClipText(`${video.title} ${video.channel}`);
  const away = teamPhrases(query.awayName, query.awayAbbr).some((phrase) => hasPhrase(title, phrase));
  const home = teamPhrases(query.homeName, query.homeAbbr).some((phrase) => hasPhrase(title, phrase));
  const tokens = playTokens(query);
  const playHits = tokens.filter((token) => hasPhrase(title, token)).length;
  if (!(away && home) && !((away || home) && playHits > 0)) return 0;
  let score = 0;
  if (away && home) score += 5;
  else if (away || home) score += 2;
  score += playHits * 2;
  if (video.kind === "highlight") score += 1;
  return score;
}

export function resolveClipLookup(input: ClipQuery & { videos: HighlightVideo[] }): ClipLookup {
  const query = buildClipSearchQuery(input);
  const searchUrl = youtubeSearchUrl(query || leagueSearchKeyword(input.league) + " highlights");
  if (!input.videos.length) return emptyClip(query, searchUrl);

  let best: { video: HighlightVideo; score: number } | null = null;
  for (const video of input.videos) {
    const score = scoreVideo(video, input);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { video, score };
  }

  if (!best) return emptyClip(query, searchUrl);

  return {
    demo: false,
    query,
    searchUrl,
    match: best.video,
    emptyHeadline: null,
    evidenceLabel: CLIP_EVIDENCE_LABEL,
  };
}

export function withClipLookup(
  board: HighlightsResponse,
  query: ClipQuery
): HighlightsResponse & { clip: ClipLookup } {
  return {
    ...board,
    clip: resolveClipLookup({
      ...query,
      league: parseLeagueParam(query.league || board.league),
      videos: board.videos,
    }),
  };
}

function firstParam(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function clipQueryFromSearchParams(params: URLSearchParams): ClipQuery | null {
  const awayName = firstParam(params.get("away"));
  const homeName = firstParam(params.get("home"));
  const playText = firstParam(params.get("q"));
  const playerName = firstParam(params.get("player"));
  const category = firstParam(params.get("category"));
  const awayAbbr = firstParam(params.get("awayAbbr"));
  const homeAbbr = firstParam(params.get("homeAbbr"));
  if (!awayName && !homeName && !playText && !playerName && !awayAbbr && !homeAbbr) {
    return null;
  }
  return {
    league: parseLeagueParam(params.get("league")),
    awayName,
    homeName,
    awayAbbr,
    homeAbbr,
    playText,
    playerName,
    category,
  };
}

export function clipQueryForGame(input: {
  league: LeagueId;
  away: Pick<TeamSide, "name" | "shortName" | "abbreviation">;
  home: Pick<TeamSide, "name" | "shortName" | "abbreviation">;
  playText?: string | null;
  leader?: Pick<LeaderLine, "name" | "category"> | null;
  scoring?: Pick<ScoringPlay, "text"> | null;
}): ClipQuery {
  return {
    league: input.league,
    awayName: input.away.shortName || input.away.name,
    homeName: input.home.shortName || input.home.name,
    awayAbbr: input.away.abbreviation,
    homeAbbr: input.home.abbreviation,
    playText: input.playText || input.scoring?.text || null,
    playerName: input.leader?.name || null,
    category: input.leader?.category || null,
  };
}

export function clipLookupForGame(
  videos: HighlightVideo[],
  input: Parameters<typeof clipQueryForGame>[0]
): ClipLookup {
  return resolveClipLookup({ ...clipQueryForGame(input), videos });
}
