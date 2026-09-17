import { espnGetV2 } from "@/lib/espn-http";
import { teamLogoUrl } from "@/lib/espn-path";
import { DEFAULT_LEAGUE, assertLeagueShipped, getLeague } from "@/lib/leagues";
import type {
  ConferenceOption,
  CoverageNote,
  LeagueId,
  RankedTeam,
  StandingsColumn,
  StandingsEntry,
  StandingsResponse,
  StandingsTable,
} from "@/lib/types";

type Json = Record<string, unknown>;

const PRIMARY_STAT_TYPES = [
  "total",
  "vsconf",
  "pointsfor",
  "pointsagainst",
  "pointdifferential",
  "differential",
  "winpercent",
  "gamesbehind",
  "streak",
] as const;

const PRIMARY_STAT_SET = new Set<string>(PRIMARY_STAT_TYPES);

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

function hexColor(value: unknown): string | null {
  const raw = str(value).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toLowerCase()}`;
}

export function defaultStandingsGroup(league: LeagueId): string | null {
  if (league === "cfb") return "80";
  if (league === "mbb") return "50";
  return null;
}

export function standingsPath(league: LeagueId, group?: string | null): string {
  const resolved = (group && group !== "all" ? group : null) ?? defaultStandingsGroup(league);
  return resolved ? `/standings?group=${encodeURIComponent(resolved)}` : "/standings";
}

export function parseConferenceParam(value: string | null | undefined): string {
  const slug = str(value).trim();
  if (!slug || slug.toLowerCase() === "all") return "all";
  if (/^\d+$/.test(slug)) return slug;
  return "all";
}

function displayText(value: unknown): string | null {
  const text = str(value).trim();
  return text ? text : null;
}

function nodeEntries(node: Json): unknown[] {
  const nested = asRecord(node.standings);
  return asArray(nested?.entries ?? node.entries);
}

function conferenceTab(node: Json): ConferenceOption | null {
  const id = displayText(node.id);
  const name = displayText(node.name) ?? displayText(node.shortName) ?? displayText(node.abbreviation);
  if (!id || !name) return null;
  return {
    id,
    name,
    abbreviation: displayText(node.abbreviation) ?? displayText(node.shortName) ?? undefined,
  };
}

function statKey(rec: Json): string | null {
  const type = str(rec.type).trim().toLowerCase();
  if (!type || type.includes("_")) return null;
  if (!PRIMARY_STAT_SET.has(type)) return null;
  return type;
}

function statLabel(key: string, rec: Json): string {
  if (key === "total") return "W-L";
  if (key === "vsconf") return "CONF";
  const abbr = str(rec.abbreviation).trim();
  const short = str(rec.shortDisplayName).trim();
  if (abbr && abbr.toLowerCase() !== "overall" && abbr.length <= 6) return abbr.toUpperCase();
  if (short) return short.toUpperCase();
  if (abbr) return abbr.toUpperCase();
  return key.toUpperCase();
}

function parseTeam(raw: unknown, league: LeagueId): RankedTeam | null {
  const team = asRecord(raw);
  if (!team) return null;
  const id = displayText(team.id);
  const name =
    displayText(team.displayName) ??
    displayText(team.location) ??
    displayText(team.shortDisplayName) ??
    displayText(team.name);
  if (!id || !name) return null;
  const abbreviation = (displayText(team.abbreviation) ?? "UNK").toUpperCase();
  const logos = asArray(team.logos);
  const logoHref = logos
    .map((row) => asRecord(row))
    .map((row) => (row ? displayText(row.href) : null))
    .find((href): href is string => Boolean(href));
  return {
    id,
    name,
    abbreviation,
    logo: logoHref || teamLogoUrl(id, league, abbreviation),
    color: hexColor(team.color),
  };
}

function parseEntry(
  raw: unknown,
  league: LeagueId
): { entry: StandingsEntry; labels: Map<string, string> } | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const team = parseTeam(rec.team, league);
  if (!team) return null;
  const stats: Record<string, string> = {};
  const labels = new Map<string, string>();
  for (const row of asArray(rec.stats)) {
    const stat = asRecord(row);
    if (!stat) continue;
    const key = statKey(stat);
    if (!key || stats[key]) continue;
    const value = displayText(stat.displayValue);
    if (!value) continue;
    stats[key] = value;
    labels.set(key, statLabel(key, stat));
  }
  return { entry: { team, stats }, labels };
}

function columnsFor(entries: StandingsEntry[], labels: Map<string, string>): StandingsColumn[] {
  const present = new Set<string>();
  for (const entry of entries) {
    for (const key of Object.keys(entry.stats)) present.add(key);
  }
  const skipDifferential = present.has("pointdifferential");
  const columns: StandingsColumn[] = [];
  for (const key of PRIMARY_STAT_TYPES) {
    if (!present.has(key)) continue;
    if (key === "differential" && skipDifferential) continue;
    columns.push({ key, label: labels.get(key) ?? key.toUpperCase() });
  }
  return columns;
}

function parseGroup(node: Json, league: LeagueId): StandingsTable | null {
  const id = displayText(node.id);
  const name = displayText(node.name) ?? displayText(node.shortName) ?? displayText(node.abbreviation);
  if (!id || !name) return null;
  const labels = new Map<string, string>();
  const entries: StandingsEntry[] = [];
  for (const raw of nodeEntries(node)) {
    const parsed = parseEntry(raw, league);
    if (!parsed) continue;
    entries.push(parsed.entry);
    for (const [key, label] of parsed.labels) {
      if (!labels.has(key)) labels.set(key, label);
    }
  }
  if (entries.length === 0) return null;
  return {
    id,
    name,
    abbreviation: displayText(node.abbreviation) ?? displayText(node.shortName),
    columns: columnsFor(entries, labels),
    entries,
  };
}

function hasPublishedEntries(node: Json, league: LeagueId): boolean {
  return nodeEntries(node).some((row) => parseEntry(row, league));
}

export function parseStandingsGroups(
  payload: unknown,
  league: LeagueId = DEFAULT_LEAGUE
): { conferences: ConferenceOption[]; groups: StandingsTable[] } {
  const root = asRecord(payload) ?? {};
  const children = asArray(root.children)
    .map(asRecord)
    .filter((row): row is Json => Boolean(row));
  const conferences = (
    children.length > 0 ? children.map(conferenceTab) : [conferenceTab(root)]
  ).filter((row): row is ConferenceOption => Boolean(row));

  const groups: StandingsTable[] = [];
  if (children.length > 0) {
    for (const child of children) {
      const nested = asArray(child.children)
        .map(asRecord)
        .filter((row): row is Json => Boolean(row));
      const nestedTables = nested.filter((row) => hasPublishedEntries(row, league));
      if (nestedTables.length > 0 && !hasPublishedEntries(child, league)) {
        for (const node of nestedTables) {
          const table = parseGroup(node, league);
          if (table) groups.push(table);
        }
        continue;
      }
      const table = parseGroup(child, league);
      if (table) groups.push(table);
    }
  } else {
    const table = parseGroup(root, league);
    if (table) groups.push(table);
  }

  return { conferences, groups };
}

function coverageFor(
  league: LeagueId,
  groups: StandingsTable[],
  groupName: string | null
): CoverageNote {
  const spec = getLeague(league);
  const live = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const scope =
    league === "cfb"
      ? "FBS (ESPN group 80) conference children"
      : league === "mbb"
        ? "Division I (ESPN group 50) conference children"
        : `${spec.label} standings children`;
  if (live === 0) {
    return {
      headline: `No ESPN standings rows for ${spec.label}`,
      detail: `ESPN’s public ${scope} feed published no rows${groupName ? ` for ${groupName}` : ""}. Records are never invented.`,
    };
  }
  return {
    headline: `${spec.shortLabel} standings from ESPN public feed`,
      detail: `${live} team${live === 1 ? "" : "s"} from ESPN’s unofficial ${scope} JSON. Only stats ESPN published (W-L, CONF, PF/PA when present) are shown — this app never invents standings rows or records.`,
  };
}

export function assembleStandingsPage({
  payload,
  league = DEFAULT_LEAGUE,
  conference,
  now = new Date(),
}: {
  payload: unknown;
  league?: LeagueId;
  conference?: string | null;
  now?: Date;
}): StandingsResponse {
  const spec = getLeague(league);
  const parsed = parseStandingsGroups(payload, spec.id);
  const conferenceId = parseConferenceParam(conference);
  const groups = parsed.groups;
  const root = asRecord(payload) ?? {};
  const season = asRecord(root.season);
  return {
    source: "espn",
    demo: false,
    league: spec.id,
    generatedAt: now.toISOString(),
    seasonYear: num(season?.year),
    groupId: displayText(root.id),
    groupName: displayText(root.name) ?? displayText(root.shortName),
    conference: conferenceId,
    conferences: parsed.conferences,
    groups,
    coverage: coverageFor(spec.id, groups, groups[0]?.name ?? displayText(root.name)),
  };
}

export async function getStandings(
  leagueParam?: LeagueId | string | null,
  conference?: string | null
): Promise<StandingsResponse> {
  const league = assertLeagueShipped(leagueParam);
  if (!league.standings) {
    return assembleStandingsPage({ payload: {}, league: league.id, conference });
  }
  const payload = await espnGetV2(standingsPath(league.id), league.id);
  return assembleStandingsPage({ payload, league: league.id, conference });
}
