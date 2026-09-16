import { espnGet } from "@/lib/espn-http";
import { parsePlay, parsePlays } from "@/lib/espn-plays";
import type { ResearchBrief, ResearchFeed } from "@/lib/research";
import type { LeagueId, PlayByPlayPlay } from "@/lib/types";

type Json = Record<string, unknown>;

export const WP_EMPTY_HEADLINE = "WIN PROBABILITY NOT ON THIS FEED";
export const WP_EVIDENCE_LABEL = "Evidence (ESPN WP series)";
export const WP_RG_FOOTNOTE =
  "ESPN published win probability is not betting advice, an ATS line, or pickcenter odds. 21+ · 1-800-GAMBLER";

const WP_EMPTY_DETAIL =
  "ESPN did not publish a winprobability series for this game. Probability is never invented from odds, predictor, or pickcenter.";

const MAX_TIPPING = 4;
const MIN_TIPPING_SWING = 0.04;

export type WinProbPoint = {
  index: number;
  playId: string | null;
  homeWinPct: number;
  awayWinPct: number;
  tiePct: number;
  playText: string | null;
  period: number | null;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type WinProbTippingPoint = {
  index: number;
  playId: string | null;
  playText: string | null;
  swing: number;
  absSwing: number;
};

export type WinProbHonesty = {
  headline: string;
  detail: string;
};

export type WinProbSeries = {
  source: "espn";
  demo: false;
  available: boolean;
  league: LeagueId | null;
  gameId: string | null;
  homeAbbr: string | null;
  awayAbbr: string | null;
  homeName: string | null;
  awayName: string | null;
  points: WinProbPoint[];
  tippingPoints: WinProbTippingPoint[];
  evidenceLabel: typeof WP_EVIDENCE_LABEL;
  honesty: WinProbHonesty;
  rgFootnote: string | null;
};

export type WinProbFetch = (path: string, league: LeagueId) => Promise<unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function pct01(value: unknown): number | null {
  const n = num(value);
  if (n === null) return null;
  if (n < 0 || n > 1.0000001) return null;
  return Math.min(1, Math.max(0, n));
}

export function emptyWinProbSeries(meta: {
  league?: LeagueId | null;
  gameId?: string | null;
} = {}): WinProbSeries {
  return {
    source: "espn",
    demo: false,
    available: false,
    league: meta.league ?? null,
    gameId: meta.gameId ?? null,
    homeAbbr: null,
    awayAbbr: null,
    homeName: null,
    awayName: null,
    points: [],
    tippingPoints: [],
    evidenceLabel: WP_EVIDENCE_LABEL,
    honesty: {
      headline: WP_EMPTY_HEADLINE,
      detail: WP_EMPTY_DETAIL,
    },
    rgFootnote: null,
  };
}

function teamsFromSummary(summary: Json): {
  homeAbbr: string | null;
  awayAbbr: string | null;
  homeName: string | null;
  awayName: string | null;
} {
  const header = asRecord(summary.header) ?? summary;
  const competitions = asArray(header.competitions);
  const first = asRecord(competitions[0]) ?? {};
  const competitors = asArray(first.competitors);
  let homeAbbr: string | null = null;
  let awayAbbr: string | null = null;
  let homeName: string | null = null;
  let awayName: string | null = null;
  for (const raw of competitors) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const team = asRecord(rec.team) ?? {};
    const abbr = str(team.abbreviation).toUpperCase() || null;
    const name = str(team.displayName || team.shortDisplayName || team.name) || null;
    if (rec.homeAway === "home") {
      homeAbbr = abbr;
      homeName = name;
    } else if (rec.homeAway === "away") {
      awayAbbr = abbr;
      awayName = name;
    }
  }
  return { homeAbbr, awayAbbr, homeName, awayName };
}

function collectPlays(summary: Json): Map<string, PlayByPlayPlay> {
  const map = new Map<string, PlayByPlayPlay>();
  const add = (play: PlayByPlayPlay | null) => {
    if (!play?.id) return;
    if (!map.has(play.id)) map.set(play.id, play);
  };
  for (const play of parsePlays(summary.plays)) add(play);
  const drives = asRecord(summary.drives);
  for (const rawDrive of [...asArray(drives?.previous), drives?.current]) {
    const drive = asRecord(rawDrive);
    if (!drive) continue;
    for (const rawPlay of asArray(drive.plays)) add(parsePlay(rawPlay));
  }
  return map;
}

function rawWinprobability(summary: Json): unknown[] {
  const direct = summary.winprobability;
  if (Array.isArray(direct)) return direct;
  const rec = asRecord(direct);
  if (rec) return asArray(rec.items ?? rec.plays);
  return [];
}

export function parseWinProbability(
  summary: unknown,
  meta: { league?: LeagueId | null; gameId?: string | null } = {}
): WinProbSeries {
  const empty = emptyWinProbSeries(meta);
  const data = asRecord(summary);
  if (!data) return empty;
  const teams = teamsFromSummary(data);
  const plays = collectPlays(data);
  const points: WinProbPoint[] = [];
  for (const raw of rawWinprobability(data)) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const homeWinPct = pct01(rec.homeWinPercentage ?? rec.homeWinPct);
    if (homeWinPct === null) continue;
    const tiePct = pct01(rec.tiePercentage) ?? 0;
    const awayWinPct = Math.min(1, Math.max(0, 1 - homeWinPct - tiePct));
    const playId = str(rec.playId) || (num(rec.playId) !== null ? String(num(rec.playId)) : "") || null;
    const play = playId ? plays.get(playId) : undefined;
    points.push({
      index: points.length,
      playId,
      homeWinPct,
      awayWinPct,
      tiePct,
      playText: play?.text ?? null,
      period: play?.period ?? null,
      clock: play?.clock ?? null,
      homeScore: play?.homeScore ?? null,
      awayScore: play?.awayScore ?? null,
    });
  }
  if (points.length === 0) {
    return { ...empty, ...teams };
  }
  return {
    source: "espn",
    demo: false,
    available: true,
    league: meta.league ?? null,
    gameId: meta.gameId ?? null,
    ...teams,
    points,
    tippingPoints: tippingPoints(points),
    evidenceLabel: WP_EVIDENCE_LABEL,
    honesty: {
      headline: "ESPN WP SERIES",
      detail: "Copied from the public ESPN summary winprobability feed. Not an odds, ATS, or pickcenter line.",
    },
    rgFootnote: WP_RG_FOOTNOTE,
  };
}

function tippingPoints(points: WinProbPoint[]): WinProbTippingPoint[] {
  const swings: WinProbTippingPoint[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const swing = points[i]!.homeWinPct - points[i - 1]!.homeWinPct;
    const absSwing = Math.abs(swing);
    if (absSwing < MIN_TIPPING_SWING) continue;
    swings.push({
      index: points[i]!.index,
      playId: points[i]!.playId,
      playText: points[i]!.playText,
      swing,
      absSwing,
    });
  }
  swings.sort((a, b) => b.absSwing - a.absSwing || a.index - b.index);
  return swings.slice(0, MAX_TIPPING);
}

export function isEspnGameId(gameId: string | null | undefined): gameId is string {
  return typeof gameId === "string" && /^\d+$/.test(gameId);
}

export async function loadWinProbSeries(options: {
  league: LeagueId | null;
  gameId: string | null;
  getSummary?: WinProbFetch;
}): Promise<WinProbSeries> {
  const empty = emptyWinProbSeries({ league: options.league, gameId: options.gameId });
  if (!options.league || !isEspnGameId(options.gameId)) return empty;
  try {
    const get = options.getSummary ?? espnGet;
    const summary = await get(`/summary?event=${options.gameId}`, options.league);
    return parseWinProbability(summary, { league: options.league, gameId: options.gameId });
  } catch {
    return empty;
  }
}

export async function attachResearchGraphs(options: {
  feed: ResearchFeed;
  selected: ResearchBrief | null;
  fallbackLeague?: LeagueId | null;
  getSummary?: WinProbFetch;
}): Promise<{
  xrayGraph: WinProbSeries | null;
  featuredXrayGraph: WinProbSeries | null;
}> {
  const loadFor = (brief: ResearchBrief | null | undefined) => {
    if (!brief || brief.kind !== "postgame-xray") return Promise.resolve(null);
    return loadWinProbSeries({
      league: brief.league ?? options.fallbackLeague ?? null,
      gameId: brief.gameId,
      getSummary: options.getSummary,
    });
  };

  if (options.selected) {
    return {
      xrayGraph: await loadFor(options.selected),
      featuredXrayGraph: null,
    };
  }

  return {
    xrayGraph: null,
    featuredXrayGraph: await loadFor(options.feed.xrays[0]),
  };
}
