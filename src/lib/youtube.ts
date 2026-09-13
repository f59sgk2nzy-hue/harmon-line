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

export type HighlightsSource = "youtube-rss" | "youtube-data-api" | "mixed" | "sample";

export type HighlightsResponse = {
  source: HighlightsSource;
  sample: boolean;
  seasonYear: number;
  generatedAt: string;
  apiKeyConfigured: boolean;
  videos: HighlightVideo[];
};

export const HIGHLIGHTS_REFRESH_MS = 15 * 60 * 1000;

const RSS_TIMEOUT_MS = 8_000;
const API_TIMEOUT_MS = 8_000;
const FEED_LIMIT = 16;

/** Curated CFB highlight + reaction channels. Public Atom RSS, no API key. */
export const CFB_YOUTUBE_CHANNELS: { id: string; kind: HighlightKind; label: string }[] = [
  { id: "UCzRWWsFjqHk1an4OnVPsl9g", kind: "highlight", label: "ESPN College Football" },
  { id: "UCpwix-O6ceqMgdxhqIynzFA", kind: "highlight", label: "CFB ON FOX" },
  { id: "UC4LeRw7pIZ_kseS4Krn_DQA", kind: "highlight", label: "Big Ten Network" },
  { id: "UCODwphyohBn9u8-FVWfbQ7g", kind: "reaction", label: "Cover 3 Podcast" },
  { id: "UC9v6icpVdER0VGQpA3uUUsQ", kind: "reaction", label: "Brandon Walker CFB" },
  { id: "UCZFVXM3LvER8xVZuJ5OGgZg", kind: "reaction", label: "Barstool Bench Mob" },
];

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function currentCfbSeasonYear(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return now.getUTCFullYear();
  return month <= 2 ? year - 1 : year;
}

export function isCurrentSeasonVideo(publishedAt: string, seasonYear: number): boolean {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return false;
  const start = Date.UTC(seasonYear, 7, 1);
  const end = Date.UTC(seasonYear + 1, 2, 1);
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

export function sampleHighlightVideos(seasonYear: number): HighlightVideo[] {
  const search = (q: string) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
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

export function assembleHighlights({
  rssVideos,
  apiVideos,
  apiKeyConfigured,
  now = new Date(),
}: {
  rssVideos: HighlightVideo[];
  apiVideos: HighlightVideo[];
  apiKeyConfigured: boolean;
  now?: Date;
}): HighlightsResponse {
  const seasonYear = currentCfbSeasonYear(now);
  const live = [...rssVideos, ...apiVideos].filter((video) =>
    isCurrentSeasonVideo(video.publishedAt, seasonYear)
  );
  const videos = mixHighlightFeed(live, FEED_LIMIT);

  if (videos.length === 0) {
    return {
      source: "sample",
      sample: true,
      seasonYear,
      generatedAt: now.toISOString(),
      apiKeyConfigured,
      videos: sampleHighlightVideos(seasonYear),
    };
  }

  const ids = new Set(videos.map((v) => v.id));
  const usedRss = rssVideos.some((v) => ids.has(v.id));
  const usedApi = apiVideos.some((v) => ids.has(v.id));
  const source: HighlightsSource =
    usedRss && usedApi ? "mixed" : usedApi ? "youtube-data-api" : "youtube-rss";

  return {
    source,
    sample: false,
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
  seasonYear: number
): Promise<HighlightVideo[]> {
  const publishedAfter = `${seasonYear}-08-01T00:00:00Z`;
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
}): Promise<HighlightsResponse> {
  const now = options?.now ?? new Date();
  const seasonYear = currentCfbSeasonYear(now);
  const apiKey = options?.apiKey?.trim() || null;

  const rssSettled = await Promise.allSettled(
    CFB_YOUTUBE_CHANNELS.map((channel) => fetchChannelRss(channel.id, channel.kind))
  );
  const rssVideos = rssSettled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  let apiVideos: HighlightVideo[] = [];
  if (apiKey) {
    const queries: { q: string; kind: HighlightKind }[] = [
      { q: `college football highlights ${seasonYear}`, kind: "highlight" },
      { q: `college football big plays ${seasonYear}`, kind: "highlight" },
      { q: `college football reaction ${seasonYear}`, kind: "reaction" },
    ];
    const apiSettled = await Promise.allSettled(
      queries.map((item) => searchYoutubeDataApi(apiKey, item.q, item.kind, seasonYear))
    );
    apiVideos = apiSettled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
  }

  return assembleHighlights({
    rssVideos,
    apiVideos,
    apiKeyConfigured: Boolean(apiKey),
    now,
  });
}
