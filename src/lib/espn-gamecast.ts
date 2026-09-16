import type {
  GamecastArticle,
  GamecastNews,
  GamecastNewsItem,
  PlayerBoxAthlete,
  PlayerBoxCategory,
  PlayerBoxTeam,
  PlayerBoxscore,
  StandingsSnippet,
  StandingsSnippetEntry,
  StandingsSnippetGroup,
  TeamBoxStatLine,
  TeamBoxStats,
} from "@/lib/types";

type Json = Record<string, unknown>;

export const NEWS_ARTICLE_LIMIT = 8;

export type GamecastDepth = {
  teamStats: TeamBoxStats[];
  playerBox: PlayerBoxscore;
  standings: StandingsSnippet | null;
  news: GamecastNews;
};

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function displayText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function teamAbbreviation(team: Json): string {
  return str(team.abbreviation, "UNK").toUpperCase();
}

function teamDisplayName(team: Json): string {
  return str(team.displayName || team.shortDisplayName || team.location || team.name);
}

function isHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedNewsHref(href: string): boolean {
  if (!isHttpUrl(href)) return false;
  try {
    const host = new URL(href).hostname.toLowerCase();
    return (
      host === "espn.com" ||
      host.endsWith(".espn.com") ||
      host === "espn.go.com" ||
      host.endsWith(".espn.go.com")
    );
  } catch {
    return false;
  }
}

function firstAllowedHref(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const href = displayText(candidate);
    if (href && isAllowedNewsHref(href)) return href;
  }
  return null;
}

function hrefFromLinks(links: unknown): string | null {
  const rec = asRecord(links);
  if (!rec) return null;
  const web = asRecord(rec.web);
  const mobile = asRecord(rec.mobile);
  const webSelf = asRecord(web?.self);
  return firstAllowedHref(web?.href, webSelf?.href, mobile?.href);
}

function parseStatLine(raw: unknown): TeamBoxStatLine | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const name = displayText(rec.name);
  const displayValue = displayText(rec.displayValue);
  if (!name || !displayValue) return null;
  return {
    name,
    label: displayText(rec.label) ?? name,
    displayValue,
  };
}

export function parseTeamBoxStats(boxscore: unknown): TeamBoxStats[] {
  const teams: TeamBoxStats[] = [];
  for (const raw of asArray(asRecord(boxscore)?.teams)) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const team = asRecord(rec.team) ?? {};
    const teamId = str(team.id || rec.id);
    if (!teamId) continue;
    const statistics = asArray(rec.statistics)
      .map(parseStatLine)
      .filter((row): row is TeamBoxStatLine => Boolean(row));
    if (statistics.length === 0) continue;
    const homeAway = rec.homeAway === "home" || rec.homeAway === "away" ? rec.homeAway : null;
    if (!homeAway) continue;
    teams.push({
      teamId,
      teamName: teamDisplayName(team) || teamAbbreviation(team),
      abbreviation: teamAbbreviation(team),
      homeAway,
      statistics,
    });
  }
  return teams;
}

function parseCopiedStats(value: unknown): string[] {
  return asArray(value).map((cell) => (typeof cell === "string" ? cell : str(cell)));
}

function parsePlayerCategory(raw: unknown): PlayerBoxCategory | null {
  const rec = asRecord(raw);
  if (!rec) return null;
    const name =
      displayText(rec.name) ??
      displayText(rec.text) ??
      displayText(asArray(rec.names)[0]) ??
      "players";
    const labels = asArray(rec.labels)
      .map((label) => displayText(label))
      .filter((label): label is string => Boolean(label));
    if (labels.length === 0) return null;

  const athletes: PlayerBoxAthlete[] = [];
  for (const row of asArray(rec.athletes)) {
    const item = asRecord(row);
    if (!item) continue;
    const athlete = asRecord(item.athlete) ?? {};
    const athleteName = displayText(athlete.displayName || athlete.fullName || athlete.lastName);
    if (!athleteName) continue;
    athletes.push({
      id: displayText(athlete.id) ?? null,
      name: athleteName,
      jersey: displayText(athlete.jersey),
      stats: parseCopiedStats(item.stats),
    });
  }
  if (athletes.length === 0) return null;

  const totalsRaw = asArray(rec.totals);
  const totals = totalsRaw.length > 0 ? parseCopiedStats(totalsRaw) : null;

  return {
    name,
    text: displayText(rec.text) ?? displayText(asArray(rec.names)[0]) ?? name,
    labels,
    athletes,
    totals,
  };
}

export function parsePlayerBoxscore(boxscore: unknown): PlayerBoxscore {
  const players = asRecord(boxscore)?.players;
  if (!Array.isArray(players) || players.length === 0) {
    return { available: false, teams: [] };
  }

  const teams: PlayerBoxTeam[] = [];
  for (const raw of players) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const team = asRecord(rec.team) ?? {};
    const teamId = str(team.id || rec.id);
    if (!teamId) continue;
    const categories = asArray(rec.statistics)
      .map(parsePlayerCategory)
      .filter((row): row is PlayerBoxCategory => Boolean(row));
    teams.push({
      teamId,
      teamName: teamDisplayName(team) || teamAbbreviation(team),
      abbreviation: teamAbbreviation(team),
      categories,
    });
  }

  return { available: teams.length > 0, teams };
}

function standingsTeamName(team: unknown): string {
  if (typeof team === "string") return team.trim();
  const rec = asRecord(team);
  if (!rec) return "";
  return str(rec.displayName || rec.location || rec.shortDisplayName || rec.name).trim();
}

function publishedRecord(
  stats: unknown[],
  match: (row: Json) => boolean
): string | null {
  for (const raw of stats) {
    const rec = asRecord(raw);
    if (!rec || !match(rec)) continue;
    return displayText(rec.displayValue) ?? displayText(rec.summary);
  }
  return null;
}

function parseStandingsEntry(raw: unknown): StandingsSnippetEntry | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = displayText(rec.id);
  const name = standingsTeamName(rec.team);
  if (!id || !name) return null;
  const stats = asArray(rec.stats);
  return {
    id,
    name,
    overall: publishedRecord(
      stats,
      (row) => row.type === "total" || str(row.name).toLowerCase() === "overall"
    ),
    conference: publishedRecord(
      stats,
      (row) =>
        row.type === "vsconf" ||
        str(row.name).toLowerCase() === "vs. conf." ||
        str(row.abbreviation).toUpperCase() === "CONF"
    ),
  };
}

function parseStandingsGroup(raw: unknown): StandingsSnippetGroup | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const nested = asRecord(rec.standings);
  const entries = asArray(nested?.entries ?? rec.entries)
    .map(parseStandingsEntry)
    .filter((row): row is StandingsSnippetEntry => Boolean(row));
  if (entries.length === 0) return null;
  return {
    header: displayText(rec.header) ?? displayText(rec.divisionHeader),
    entries,
  };
}

export function parseStandingsSnippet(standings: unknown): StandingsSnippet | null {
  const rec = asRecord(standings);
  if (!rec) return null;
  const groups = asArray(rec.groups)
    .map(parseStandingsGroup)
    .filter((row): row is StandingsSnippetGroup => Boolean(row));
  if (groups.length === 0) return null;

  const link = asRecord(rec.fullViewLink);
  const href = displayText(link?.href);
  const fullViewLink =
    href && isHttpUrl(href)
      ? { text: displayText(link?.text) ?? "Full Standings", href }
      : null;

  return {
    header: displayText(rec.header),
    fullViewLink,
    groups,
  };
}

function parseArticle(raw: unknown): GamecastArticle | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const headline = displayText(rec.headline);
  if (!headline) return null;
  return {
    type: displayText(rec.type),
    headline,
    href: hrefFromLinks(rec.links),
  };
}

function parseNewsArticles(raw: unknown): GamecastNewsItem[] {
  const rec = asRecord(raw);
  const items: GamecastNewsItem[] = [];
  for (const row of asArray(rec?.articles ?? raw)) {
    if (items.length >= NEWS_ARTICLE_LIMIT) break;
    const article = asRecord(row);
    if (!article) continue;
    const headline = displayText(article.headline);
    const href = hrefFromLinks(article.links);
    if (!headline || !href) continue;
    items.push({
      headline,
      href,
      type: displayText(article.type),
    });
  }
  return items;
}

export function parseGamecastDepth(summary: unknown): GamecastDepth {
  const data = asRecord(summary) ?? {};
  return {
    teamStats: parseTeamBoxStats(data.boxscore),
    playerBox: parsePlayerBoxscore(data.boxscore),
    standings: parseStandingsSnippet(data.standings),
    news: {
      article: parseArticle(data.article),
      articles: parseNewsArticles(data.news),
    },
  };
}

export function pairTeamStatRows(teams: TeamBoxStats[]): Array<{
  name: string;
  label: string;
  away: string | null;
  home: string | null;
}> {
  const away = teams.find((row) => row.homeAway === "away");
  const home = teams.find((row) => row.homeAway === "home");
  const names: string[] = [];
  const seen = new Set<string>();
  for (const team of [away, home]) {
    if (!team) continue;
    for (const stat of team.statistics) {
      if (seen.has(stat.name)) continue;
      seen.add(stat.name);
      names.push(stat.name);
    }
  }
  const lookup = (team: TeamBoxStats | undefined, name: string) =>
    team?.statistics.find((row) => row.name === name) ?? null;
  return names.map((name) => {
    const awayStat = lookup(away, name);
    const homeStat = lookup(home, name);
    return {
      name,
      label: awayStat?.label || homeStat?.label || name,
      away: awayStat?.displayValue ?? null,
      home: homeStat?.displayValue ?? null,
    };
  });
}
