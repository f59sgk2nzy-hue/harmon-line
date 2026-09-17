import { DEFAULT_LEAGUE, LEAGUE_IDS, parseLeagueParam } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";

export type HighlightKind = "highlight" | "reaction";

export type HighlightVideo = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnailUrl: string;
  watchUrl: string;
  kind: HighlightKind;
  sample: boolean;
};

export type HighlightsSource = "youtube-rss" | "youtube-data-api" | "mixed" | "sample" | "empty";

export type YoutubeChannel = { id: string; kind: HighlightKind; label: string };

export type HighlightsResponse = {
  source: HighlightsSource;
  sample: boolean;
  demo: false;
  league: LeagueId;
  seasonYear: number;
  generatedAt: string;
  apiKeyConfigured: boolean;
  videos: HighlightVideo[];
};

export const HIGHLIGHTS_REFRESH_MS = 15 * 60 * 1000;
export const HIGHLIGHTS_EMPTY_HEADLINE = "NO CLIPS ON THIS FEED";

const RSS_TIMEOUT_MS = 8_000;
const API_TIMEOUT_MS = 8_000;
const FEED_LIMIT = 16;

export const LEAGUE_YOUTUBE_CHANNELS: Record<LeagueId, YoutubeChannel[]> = {
  cfb: [
    { id: "UCzRWWsFjqHk1an4OnVPsl9g", kind: "highlight", label: "ESPN College Football" },
    { id: "UCpwix-O6ceqMgdxhqIynzFA", kind: "highlight", label: "CFB ON FOX" },
    { id: "UC4LeRw7pIZ_kseS4Krn_DQA", kind: "highlight", label: "Big Ten Network" },
    { id: "UCODwphyohBn9u8-FVWfbQ7g", kind: "reaction", label: "Cover 3 Podcast" },
    { id: "UC9v6icpVdER0VGQpA3uUUsQ", kind: "reaction", label: "Brandon Walker CFB" },
    { id: "UCZFVXM3LvER8xVZuJ5OGgZg", kind: "reaction", label: "Barstool Bench Mob" },
  ],
  mbb: [
    { id: "UCKjEtnnXEHsXE9IvCb92V7g", kind: "highlight", label: "March Madness" },
    { id: "UC4LeRw7pIZ_kseS4Krn_DQA", kind: "highlight", label: "Big Ten Network" },
    { id: "UCja8sZ2T4ylIqjggA1Zuukg", kind: "highlight", label: "CBS Sports" },
    { id: "UC9by2xjmM_ldmvIwYrARCDg", kind: "reaction", label: "The Field Of 68: After Dark" },
  ],
  nfl: [
    { id: "UCDVYQ4Zhbm3S2dlz7P1GBDg", kind: "highlight", label: "NFL" },
    { id: "UC_1H9v258pXiyLDaW0R5exw", kind: "highlight", label: "NFL Network" },
    { id: "UCwNqHDsnBCKT-olwJwIFyfg", kind: "highlight", label: "FOX Sports" },
    { id: "UCxcTeAKWJca6XyJ37_ZoKIQ", kind: "reaction", label: "The Pat McAfee Show" },
    { id: "UC9PKpPDyCi_Jck8j3e6N-_g", kind: "reaction", label: "Pardon My Take" },
  ],
  nba: [
    { id: "UCWJ2lWNubArHWmf3FIHbfcQ", kind: "highlight", label: "NBA" },
    { id: "UCVSSpcmZD2PwPBqb8yKQKBA", kind: "highlight", label: "NBA on ESPN" },
    { id: "UCqQo7ewe87aYAe7ub5UqXMw", kind: "highlight", label: "House of Highlights" },
    { id: "UClhp9g6TPiqCTOlcw0ROfNg", kind: "reaction", label: "TNT Sports" },
  ],
  mlb: [
    { id: "UCoLrcjPV5PbUrUyXq5mjc_A", kind: "highlight", label: "MLB" },
    { id: "UCnfdlSStduhKXE9Qp9-edsA", kind: "highlight", label: "MLB Network" },
    { id: "UCeQ5xiPb9TMpTQIjcscvBRg", kind: "reaction", label: "Talkin' Baseball" },
    { id: "UCl9E4Zxa8CVr2LBLD0_TaNg", kind: "reaction", label: "Jomboy Media" },
  ],
};

/** Curated CFB highlight + reaction channels. Public Atom RSS, no API key. */
export const CFB_YOUTUBE_CHANNELS = LEAGUE_YOUTUBE_CHANNELS.cfb;

export function youtubeChannelsFor(league: LeagueId | string | null | undefined = DEFAULT_LEAGUE): YoutubeChannel[] {
  return LEAGUE_YOUTUBE_CHANNELS[parseLeagueParam(league)];
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Public YouTube results page — not a claimed clip id. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function isYoutubeWatchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.length > 1;
    if (host !== "youtube.com") return false;
    if (parsed.pathname === "/watch") return Boolean(parsed.searchParams.get("v"));
    return parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

function easternYearMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return {
    year: Number.isFinite(year) ? year : now.getUTCFullYear(),
    month: Number.isFinite(month) ? month : now.getUTCMonth() + 1,
  };
}

export function currentCfbSeasonYear(now = new Date()): number {
  const { year, month } = easternYearMonth(now);
  return month <= 2 ? year - 1 : year;
}

export function currentSeasonYear(league: LeagueId = DEFAULT_LEAGUE, now = new Date()): number {
  const { year, month } = easternYearMonth(now);
  if (league === "nba") return month >= 10 ? year : year - 1;
  if (league === "mbb") return month >= 11 ? year : year - 1;
  return month <= 2 ? year - 1 : year;
}

const CFB_NON_SPORT =
  /\b(soccer|basketball|baseball|softball|volleyball|hockey|lacrosse|wrestling|gymnast|track and field|swimming|water polo)\b/i;
const CFB_SIGNAL =
  /\b(football|cfb|fbs|fcs|heisman|touchdown|quarterback|kickoff|college football|ncaaf|cy-hawk)\b/i;
const CFB_PROGRAMS =
  /\b(alabama|auburn|georgia|florida|lsu|tennessee|kentucky|ole miss|mississippi|arkansas|missouri|oklahoma|texas|baylor|tcu|houston|ohio state|michigan|penn state|oregon|washington|usc|ucla|iowa|wisconsin|nebraska|illinois|indiana|purdue|minnesota|maryland|rutgers|notre dame|clemson|miami|florida state|north carolina|nc state|virginia|louisville|syracuse|pitt|stanford|colorado|utah|arizona|kansas|byu|cincinnati|ucf|memphis|tulane|navy|army|boise state|liberty)\b/i;

const MBB_NON_SPORT =
  /football|\b(soccer|baseball|softball|volleyball|hockey|lacrosse|wrestling|nfl|nba|mlb|wnba|nascar)\b/i;
const MBB_SIGNAL =
  /\b(basketball|hoops|march madness|cbb|ncaab|ncaa tournament|college basketball|college hoops)\b/i;
const MBB_PROGRAMS =
  /\b(duke|kansas|gonzaga|uconn|connecticut|kentucky|north carolina|unc|houston|purdue|arizona|tennessee|auburn|alabama|baylor|iowa state|creighton|marquette|villanova|syracuse|indiana|michigan state|illinois|wisconsin|ucla|arkansas|texas|ohio state)\b/i;

const NFL_NON_SPORT =
  /\b(soccer|basketball|baseball|hockey|mlb|nba|wnba|nascar|wwe|golf|college football|cfb|ncaaf|march madness)\b/i;
const NFL_SIGNAL = /\b(nfl|super bowl|pro bowl|nfl draft|thursday night football|monday night football)\b/i;
const NFL_PROGRAMS =
  /\b(chiefs|eagles|bills|cowboys|49ers|niners|packers|ravens|bengals|steelers|dolphins|jets|patriots|chargers|raiders|broncos|texans|colts|jaguars|titans|browns|saints|falcons|panthers|buccaneers|bucs|seahawks|rams|commanders|bears|lions|vikings)\b/i;

const NBA_NON_SPORT =
  /\b(football|soccer|baseball|hockey|mlb|nfl|wnba|nascar|golf|college basketball|march madness|cfb)\b/i;
const NBA_SIGNAL = /\b(nba|nba finals|nba draft|all-star weekend)\b/i;
const NBA_PROGRAMS =
  /\b(lakers|celtics|warriors|knicks|nets|76ers|sixers|bulls|heat|bucks|nuggets|suns|mavericks|mavs|clippers|kings|pelicans|grizzlies|spurs|rockets|thunder|timberwolves|blazers|jazz|hawks|hornets|wizards|pistons|pacers|raptors|magic|cavs|cavaliers)\b/i;

const MLB_NON_SPORT =
  /\b(football|soccer|basketball|hockey|nba|nfl|nhl|cfb|wnba|nascar|college football)\b/i;
const MLB_SIGNAL = /\b(mlb|baseball|home run|world series|walk-off|no-hitter|perfect game|opening day)\b/i;
const MLB_PROGRAMS =
  /\b(yankees|red sox|dodgers|cubs|mets|braves|phillies|astros|rangers|orioles|guardians|twins|mariners|padres|giants|cardinals|brewers|reds|pirates|nationals|marlins|rockies|athletics|white sox|tigers|royals|angels|blue jays|rays)\b/i;

const MIXED_SPORTS_CHANNELS = new Set(["big ten network", "barstool bench mob", "cbs sports", "fox sports", "house of highlights", "tnt sports", "pardon my take", "the pat mcafee show", "jomboy media"]);

function onlyChannelsFor(league: LeagueId): Set<string> {
  return new Set(
    youtubeChannelsFor(league)
      .filter((c) => !MIXED_SPORTS_CHANNELS.has(c.label.toLowerCase()))
      .map((c) => c.label.toLowerCase())
  );
}

type SportFilter = {
  other: RegExp;
  signal: RegExp;
  programs: RegExp;
};

const FILTERS: Record<LeagueId, SportFilter> = {
  cfb: { other: CFB_NON_SPORT, signal: CFB_SIGNAL, programs: CFB_PROGRAMS },
  mbb: { other: MBB_NON_SPORT, signal: MBB_SIGNAL, programs: MBB_PROGRAMS },
  nfl: { other: NFL_NON_SPORT, signal: NFL_SIGNAL, programs: NFL_PROGRAMS },
  nba: { other: NBA_NON_SPORT, signal: NBA_SIGNAL, programs: NBA_PROGRAMS },
  mlb: { other: MLB_NON_SPORT, signal: MLB_SIGNAL, programs: MLB_PROGRAMS },
};

export function isLeagueVideo(league: LeagueId, title: string, channel: string): boolean {
  const resolved = parseLeagueParam(league);
  const spec = FILTERS[resolved];
  if (spec.other.test(title)) return false;
  const ch = channel.toLowerCase();
  const ownChannels = onlyChannelsFor(resolved);
  for (const other of LEAGUE_IDS) {
    if (other === resolved) continue;
    if (onlyChannelsFor(other).has(ch) && !ownChannels.has(ch)) return false;
  }
  if (spec.signal.test(title) || spec.signal.test(channel)) return true;
  if (ownChannels.has(ch)) return true;
  if (resolved === "cfb" && (ch.includes("college football") || ch.includes("cfb"))) return true;
  if (MIXED_SPORTS_CHANNELS.has(ch) && resolved !== "cfb") return false;
  return spec.programs.test(title);
}

export function isCollegeFootballVideo(title: string, channel: string): boolean {
  return isLeagueVideo("cfb", title, channel);
}

export function seasonWindowUtc(league: LeagueId, seasonYear: number): { start: number; end: number } {
  switch (parseLeagueParam(league)) {
    case "nba":
      return { start: Date.UTC(seasonYear, 9, 1), end: Date.UTC(seasonYear + 1, 9, 1) };
    case "mbb":
      return { start: Date.UTC(seasonYear, 10, 1), end: Date.UTC(seasonYear + 1, 10, 1) };
    case "mlb":
      return { start: Date.UTC(seasonYear, 2, 1), end: Date.UTC(seasonYear + 1, 0, 1) };
    default:
      return { start: Date.UTC(seasonYear, 7, 1), end: Date.UTC(seasonYear + 1, 2, 1) };
  }
}

export function isCurrentSeasonVideo(
  publishedAt: string,
  seasonYear: number,
  league: LeagueId = DEFAULT_LEAGUE
): boolean {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = seasonWindowUtc(league, seasonYear);
  const ts = date.getTime();
  return ts >= start && ts < end;
}

export function classifyVideoKind(
  title: string,
  channelKind: HighlightKind = "highlight"
): HighlightKind {
  const text = title.toLowerCase();
  const reaction =
    /\breact(?:ing|ion|s)?\b/.test(text) ||
    text.includes("instant reaction") ||
    text.includes("takes from");
  const highlight =
    /\bhighlights?\b/.test(text) ||
    /\bbig plays?\b/.test(text) ||
    text.includes("full game") ||
    text.includes("game winner");
  if (reaction && !highlight) return "reaction";
  if (highlight && !reaction) return "highlight";
  if (highlight && reaction) {
    return text.indexOf("react") < text.indexOf("highlight") ? "reaction" : "highlight";
  }
  return channelKind;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function innerTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim() ?? "";
}

function thumbnailFromEntry(entry: string, videoId: string): string {
  const match = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/);
  return match?.[1] ?? youtubeThumbnailUrl(videoId);
}

export function parseYoutubeAtom(
  xml: string,
  channelKind: HighlightKind = "highlight"
): HighlightVideo[] {
  if (!xml.includes("<entry>")) return [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: HighlightVideo[] = [];

  for (const entry of entries) {
    const id = innerTag(entry, "yt:videoId");
    const title = decodeXml(innerTag(entry, "title"));
    if (!id || !title) continue;
    const channel = decodeXml(innerTag(entry, "name")) || "YouTube";
    const publishedAt = innerTag(entry, "published");
    videos.push({
      id,
      title,
      channel,
      publishedAt,
      thumbnailUrl: thumbnailFromEntry(entry, id),
      watchUrl: youtubeWatchUrl(id),
      kind: classifyVideoKind(title, channelKind),
      sample: false,
    });
  }

  return videos;
}

function byPublishedDesc(a: HighlightVideo, b: HighlightVideo): number {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export function mixHighlightFeed(videos: HighlightVideo[], limit = FEED_LIMIT): HighlightVideo[] {
  const seen = new Set<string>();
  const unique: HighlightVideo[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    unique.push(video);
  }

  const highlights = unique.filter((v) => v.kind === "highlight").sort(byPublishedDesc);
  const reactions = unique.filter((v) => v.kind === "reaction").sort(byPublishedDesc);
  const startWithReaction =
    reactions.length > 0 &&
    (highlights.length === 0 ||
      new Date(reactions[0]!.publishedAt).getTime() >=
        new Date(highlights[0]!.publishedAt).getTime());

  const mixed: HighlightVideo[] = [];
  let h = 0;
  let r = 0;
  const take = (from: HighlightVideo[], index: number) => {
    if (index < from.length && mixed.length < limit) {
      mixed.push(from[index]!);
      return index + 1;
    }
    return index;
  };

  while (mixed.length < limit && (h < highlights.length || r < reactions.length)) {
    if (startWithReaction) {
      r = take(reactions, r);
      h = take(highlights, h);
    } else {
      h = take(highlights, h);
      r = take(reactions, r);
    }
  }

  return mixed;
}

export function emptyHighlightsBoard(
  league: LeagueId = DEFAULT_LEAGUE,
  now = new Date(),
  apiKeyConfigured = Boolean(process.env.YOUTUBE_API_KEY?.trim())
): HighlightsResponse {
  return {
    source: "empty",
    sample: false,
    demo: false,
    league: parseLeagueParam(league),
    seasonYear: currentSeasonYear(league, now),
    generatedAt: now.toISOString(),
    apiKeyConfigured,
    videos: [],
  };
}

export function sampleHighlightsBoard(now = new Date()): HighlightsResponse {
  const seasonYear = currentCfbSeasonYear(now);
  return {
    source: "sample",
    sample: true,
    demo: false,
    league: DEFAULT_LEAGUE,
    seasonYear,
    generatedAt: now.toISOString(),
    apiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    videos: sampleHighlightVideos(seasonYear),
  };
}

export function highlightsSourceNote(board: HighlightsResponse | null): string {
  if (!board) return "LOADING YOUTUBE FEED";
  if (board.source === "empty" || board.videos.length === 0) {
    return `${HIGHLIGHTS_EMPTY_HEADLINE}  ·  NEVER INVENTED`;
  }
  if (board.sample) {
    return "SAMPLE CARDS  ·  LIVE YOUTUBE FEED UNAVAILABLE  ·  NOT LIVE SCORES";
  }
  if (board.source === "mixed") return "YOUTUBE RSS + DATA API  ·  NO DEMO SCORES";
  if (board.source === "youtube-data-api") return "YOUTUBE DATA API  ·  NO DEMO SCORES";
  return "YOUTUBE RSS  ·  NO API KEY  ·  NO DEMO SCORES";
}

export function sampleHighlightVideos(seasonYear: number): HighlightVideo[] {
  const search = (q: string) => youtubeSearchUrl(q);
  return [
    {
      id: "sample-highlight-1",
      title: `SAMPLE — ${seasonYear} college football highlights (live YouTube feed unavailable)`,
      channel: "The Harmon Line",
      publishedAt: `${seasonYear}-09-01T00:00:00.000Z`,
      thumbnailUrl: "",
      watchUrl: search(`college football highlights ${seasonYear}`),
      kind: "highlight",
      sample: true,
    },
    {
      id: "sample-reaction-1",
      title: `SAMPLE — ${seasonYear} college football reaction (live YouTube feed unavailable)`,
      channel: "The Harmon Line",
      publishedAt: `${seasonYear}-09-01T00:00:00.000Z`,
      thumbnailUrl: "",
      watchUrl: search(`college football reaction ${seasonYear}`),
      kind: "reaction",
      sample: true,
    },
    {
      id: "sample-highlight-2",
      title: `SAMPLE — Big-play reel search for the ${seasonYear} season`,
      channel: "The Harmon Line",
      publishedAt: `${seasonYear}-09-01T00:00:00.000Z`,
      thumbnailUrl: "",
      watchUrl: search(`college football big plays ${seasonYear}`),
      kind: "highlight",
      sample: true,
    },
    {
      id: "sample-reaction-2",
      title: `SAMPLE — Instant reaction search for trending ${seasonYear} games`,
      channel: "The Harmon Line",
      publishedAt: `${seasonYear}-09-01T00:00:00.000Z`,
      thumbnailUrl: "",
      watchUrl: search(`college football instant reaction ${seasonYear}`),
      kind: "reaction",
      sample: true,
    },
  ];
}

export function highlightsSearchQueries(
  league: LeagueId,
  seasonYear: number
): { q: string; kind: HighlightKind }[] {
  switch (parseLeagueParam(league)) {
    case "mbb":
      return [
        { q: `college basketball highlights ${seasonYear}`, kind: "highlight" },
        { q: `march madness highlights ${seasonYear}`, kind: "highlight" },
        { q: `college basketball reaction ${seasonYear}`, kind: "reaction" },
      ];
    case "nfl":
      return [
        { q: `nfl highlights ${seasonYear}`, kind: "highlight" },
        { q: `nfl big plays ${seasonYear}`, kind: "highlight" },
        { q: `nfl reaction ${seasonYear}`, kind: "reaction" },
      ];
    case "nba":
      return [
        { q: `nba highlights ${seasonYear}`, kind: "highlight" },
        { q: `nba big plays ${seasonYear}`, kind: "highlight" },
        { q: `nba reaction ${seasonYear}`, kind: "reaction" },
      ];
    case "mlb":
      return [
        { q: `mlb highlights ${seasonYear}`, kind: "highlight" },
        { q: `mlb home runs ${seasonYear}`, kind: "highlight" },
        { q: `mlb reaction ${seasonYear}`, kind: "reaction" },
      ];
    default:
      return [
        { q: `college football highlights ${seasonYear}`, kind: "highlight" },
        { q: `college football big plays ${seasonYear}`, kind: "highlight" },
        { q: `college football reaction ${seasonYear}`, kind: "reaction" },
      ];
  }
}

export function assembleHighlights({
  rssVideos,
  apiVideos,
  apiKeyConfigured,
  now = new Date(),
  league = DEFAULT_LEAGUE,
}: {
  rssVideos: HighlightVideo[];
  apiVideos: HighlightVideo[];
  apiKeyConfigured: boolean;
  now?: Date;
  league?: LeagueId;
}): HighlightsResponse {
  const resolved = parseLeagueParam(league);
  const seasonYear = currentSeasonYear(resolved, now);
  const live = [...rssVideos, ...apiVideos].filter(
    (video) =>
      isCurrentSeasonVideo(video.publishedAt, seasonYear, resolved) &&
      isLeagueVideo(resolved, video.title, video.channel)
  );
  const videos = mixHighlightFeed(live, FEED_LIMIT);

  if (videos.length === 0) {
    return emptyHighlightsBoard(resolved, now, apiKeyConfigured);
  }

  const ids = new Set(videos.map((v) => v.id));
  const usedRss = rssVideos.some((v) => ids.has(v.id));
  const usedApi = apiVideos.some((v) => ids.has(v.id));
  const source: HighlightsSource =
    usedRss && usedApi ? "mixed" : usedApi ? "youtube-data-api" : "youtube-rss";

  return {
    source,
    sample: false,
    demo: false,
    league: resolved,
    seasonYear,
    generatedAt: now.toISOString(),
    apiKeyConfigured,
    videos,
  };
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/atom+xml, application/json, text/xml, */*" },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchChannelRss(
  channelId: string,
  channelKind: HighlightKind
): Promise<HighlightVideo[]> {
  const xml = await fetchText(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    RSS_TIMEOUT_MS
  );
  return xml ? parseYoutubeAtom(xml, channelKind) : [];
}

type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
};

export function parseYoutubeSearchItems(
  items: YoutubeSearchItem[],
  kind: HighlightKind
): HighlightVideo[] {
  const videos: HighlightVideo[] = [];
  for (const item of items) {
    const id = item.id?.videoId;
    const title = item.snippet?.title;
    if (!id || !title) continue;
    videos.push({
      id,
      title,
      channel: item.snippet?.channelTitle || "YouTube",
      publishedAt: item.snippet?.publishedAt || "",
      thumbnailUrl:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        youtubeThumbnailUrl(id),
      watchUrl: youtubeWatchUrl(id),
      kind: classifyVideoKind(title, kind),
      sample: false,
    });
  }
  return videos;
}

export async function searchYoutubeDataApi(
  apiKey: string,
  query: string,
  kind: HighlightKind,
  seasonYear: number,
  league: LeagueId = DEFAULT_LEAGUE
): Promise<HighlightVideo[]> {
  const publishedAfter = new Date(seasonWindowUtc(league, seasonYear).start).toISOString();
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("order", "date");
  url.searchParams.set("q", query);
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("key", apiKey);

  const body = await fetchText(url.toString(), API_TIMEOUT_MS);
  if (!body) return [];
  try {
    const payload = JSON.parse(body) as { items?: YoutubeSearchItem[] };
    return parseYoutubeSearchItems(payload.items ?? [], kind);
  } catch {
    return [];
  }
}

export async function loadHighlights(options?: {
  apiKey?: string | null;
  now?: Date;
  league?: LeagueId | string | null;
}): Promise<HighlightsResponse> {
  const now = options?.now ?? new Date();
  const league = parseLeagueParam(options?.league);
  const seasonYear = currentSeasonYear(league, now);
  const apiKey = options?.apiKey?.trim() || null;

  const rssSettled = await Promise.allSettled(
    youtubeChannelsFor(league).map((channel) => fetchChannelRss(channel.id, channel.kind))
  );
  const rssVideos = rssSettled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  let apiVideos: HighlightVideo[] = [];
  if (apiKey) {
    const queries = highlightsSearchQueries(league, seasonYear);
    const apiSettled = await Promise.allSettled(
      queries.map((item) => searchYoutubeDataApi(apiKey, item.q, item.kind, seasonYear, league))
    );
    apiVideos = apiSettled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
  }

  return assembleHighlights({
    league,
    rssVideos,
    apiVideos,
    apiKeyConfigured: Boolean(apiKey),
    now,
  });
}
