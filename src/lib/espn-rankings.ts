import { espnGet } from "@/lib/espn-http";
import { teamLogoUrl } from "@/lib/espn-path";
import { DEFAULT_LEAGUE, assertLeagueShipped, getLeague } from "@/lib/leagues";
import type {
  CoverageNote,
  LeagueId,
  PollId,
  RankTrend,
  RankingPoll,
  RankingRow,
  RankingsResponse,
} from "@/lib/types";

type Json = Record<string, unknown>;

export const POLL_TABS: ReadonlyArray<{
  id: PollId;
  label: string;
  longLabel: string;
  name: string;
}> = [
  { id: "ap", label: "AP", longLabel: "AP TOP 25", name: "AP Top 25" },
  { id: "coaches", label: "COACHES", longLabel: "COACHES", name: "AFCA Coaches Poll" },
  { id: "fcs", label: "FCS", longLabel: "FCS", name: "FCS Coaches Poll" },
  { id: "d2", label: "D2", longLabel: "D2", name: "AFCA Division II Coaches Poll" },
  { id: "d3", label: "D3", longLabel: "D3", name: "AFCA Division III Coaches Poll" },
];

export const MBB_POLL_TABS: ReadonlyArray<{
  id: PollId;
  label: string;
  longLabel: string;
  name: string;
}> = [
  { id: "ap", label: "AP", longLabel: "AP TOP 25", name: "AP Top 25" },
  { id: "coaches", label: "COACHES", longLabel: "COACHES", name: "Coaches Poll" },
];

export function pollTabsFor(league: LeagueId = DEFAULT_LEAGUE) {
  if (!getLeague(league).rankings) return [];
  return league === "mbb" ? MBB_POLL_TABS : POLL_TABS;
}

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

export function parsePollParam(
  value: string | null | undefined,
  league: LeagueId = DEFAULT_LEAGUE
): PollId {
  const slug = str(value).trim().toLowerCase();
  const tabs = pollTabsFor(league);
  if (tabs.some((tab) => tab.id === slug)) return slug as PollId;
  return "ap";
}

export function rankingsHref(poll: PollId, league: LeagueId = DEFAULT_LEAGUE): string {
  const params = new URLSearchParams();
  if (poll !== "ap") params.set("poll", poll);
  if (league !== DEFAULT_LEAGUE) params.set("league", league);
  const query = params.toString();
  return query ? `/rankings?${query}` : "/rankings";
}

export function parseRankTrend(value: unknown): RankTrend {
  const raw = str(value).trim();
  if (!raw) return { direction: null, label: null };
  if (raw === "-") return { direction: "even", label: "-" };
  if (/^\+\d+$/.test(raw)) return { direction: "up", label: raw };
  if (/^-\d+$/.test(raw)) return { direction: "down", label: raw };
  return { direction: null, label: raw };
}

function pollIdFromEspn(raw: Json): PollId | null {
  const id = str(raw.id);
  const type = str(raw.type).toLowerCase();
  const hay = `${str(raw.name)} ${str(raw.shortName)}`.toLowerCase();
  if (id === "1" || type === "ap") return "ap";
  if (id === "2" || type === "usa") return "coaches";
  if (id === "20" || type === "fcs") return "fcs";
  if (id === "11") return "d2";
  if (id === "12") return "d3";
  if (hay.includes("division iii") || hay.includes("div iii")) return "d3";
  if (hay.includes("division ii") || hay.includes("div ii")) return "d2";
  if (hay.includes("fcs")) return "fcs";
  if (/\bap\b/.test(hay)) return "ap";
  if (hay.includes("coaches")) return "coaches";
  return null;
}

function parseRow(raw: unknown, league: LeagueId = DEFAULT_LEAGUE): RankingRow | null {
  const row = asRecord(raw);
  if (!row) return null;
  const rank = num(row.current);
  if (rank == null || rank <= 0) return null;
  const team = asRecord(row.team) ?? {};
  const id = str(team.id);
  if (!id) return null;
  const name = str(team.nickname || team.location || team.displayName || team.name, "Unknown");
  const abbreviation = str(team.abbreviation, "UNK").toUpperCase();
  return {
    rank,
    previous: num(row.previous),
    points: num(row.points),
    record: str(row.recordSummary) || null,
    trend: parseRankTrend(row.trend),
    team: {
      id,
      name,
      abbreviation,
      logo: str(team.logo) || teamLogoUrl(id, league),
      color: hexColor(team.color),
    },
  };
}

function emptyPoll(id: PollId, league: LeagueId = DEFAULT_LEAGUE): RankingPoll {
  const tab = pollTabsFor(league).find((item) => item.id === id) ?? pollTabsFor(league)[0];
  return {
    id,
    espnId: null,
    name: tab.name,
    shortName: tab.label,
    headline: "ESPN has not published this poll",
    week: null,
    occurrence: null,
    ranks: [],
  };
}

function parsePoll(raw: unknown, league: LeagueId = DEFAULT_LEAGUE): RankingPoll | null {
  const poll = asRecord(raw);
  if (!poll) return null;
  const id = pollIdFromEspn(poll);
  if (!id) return null;
  if (!pollTabsFor(league).some((tab) => tab.id === id)) return null;
  const occurrence = asRecord(poll.occurrence);
  const ranks = asArray(poll.ranks)
    .map((row) => parseRow(row, league))
    .filter((row): row is RankingRow => Boolean(row))
    .sort((a, b) => a.rank - b.rank);
  const tab = pollTabsFor(league).find((item) => item.id === id);
  return {
    id,
    espnId: str(poll.id) || null,
    name: str(poll.name, tab?.name ?? "Poll"),
    shortName: str(poll.shortName, tab?.label ?? id.toUpperCase()),
    headline: str(poll.headline, ranks.length ? str(poll.name, "ESPN rankings") : "ESPN has not published this poll"),
    week: num(occurrence?.number),
    occurrence: str(occurrence?.displayValue) || null,
    ranks,
  };
}

export function parseRankingsPayload(
  payload: unknown,
  league: LeagueId = DEFAULT_LEAGUE
): RankingPoll[] {
  const root = asRecord(payload) ?? {};
  const byId = new Map<PollId, RankingPoll>();
  for (const raw of asArray(root.rankings)) {
    const poll = parsePoll(raw, league);
    if (!poll) continue;
    byId.set(poll.id, poll);
  }
  return pollTabsFor(league)
    .map((tab) => byId.get(tab.id))
    .filter((poll): poll is RankingPoll => Boolean(poll));
}

function coverageFor(polls: RankingPoll[], league: LeagueId = DEFAULT_LEAGUE): CoverageNote {
  if (!getLeague(league).rankings) {
    const label = getLeague(league).label;
    return {
      headline: `No ESPN rankings for ${label}`,
      detail: `ESPN’s public /rankings JSON 404s for ${label}. This page does not fabricate polls or poll points.`,
    };
  }
  const live = polls.filter((poll) => poll.ranks.length > 0).map((poll) => poll.shortName);
  const sport = league === "mbb" ? "men’s college basketball" : "college-football";
  return {
    headline: "Rankings from ESPN public poll feed",
    detail:
      live.length > 0
        ? `${live.join(", ")} come from ESPN’s unofficial ${sport} /rankings JSON. Points and trends are whatever ESPN published — this app does not fabricate poll points.`
        : "ESPN’s public /rankings JSON did not include a ranked poll. No sample points are shown.",
  };
}

export function assembleRankingsPage({
  payload,
  poll,
  league = DEFAULT_LEAGUE,
  now = new Date(),
}: {
  payload: unknown;
  poll: PollId;
  league?: LeagueId;
  now?: Date;
}): RankingsResponse {
  const tabs = pollTabsFor(league);
  const parsed = parseRankingsPayload(payload, league);
  const byId = new Map(parsed.map((item) => [item.id, item]));
  const polls = tabs.map((tab) => byId.get(tab.id) ?? emptyPoll(tab.id, league));
  const requested = parsePollParam(poll, league);
  const selected = polls.find((item) => item.id === requested) ?? polls[0] ?? null;
  const root = asRecord(payload) ?? {};
  const season = asRecord(root.requestedSeason) ?? asRecord(root.latestSeason);
  const seasonWeek = asRecord(season?.week) ?? asRecord(root.latestWeek);
  return {
    source: "espn",
    demo: false,
    league,
    generatedAt: now.toISOString(),
    week: num(seasonWeek?.number) ?? selected?.week ?? null,
    seasonYear: num(season?.year),
    poll: selected?.id ?? "ap",
    polls,
    selected,
    coverage: coverageFor(polls, league),
  };
}

export async function getRankings(
  poll: PollId = "ap",
  leagueParam?: LeagueId | string | null
): Promise<RankingsResponse> {
  const league = assertLeagueShipped(leagueParam);
  if (!league.rankings) {
    return assembleRankingsPage({ payload: {}, poll, league: league.id });
  }
  const payload = await espnGet("/rankings", league.id);
  return assembleRankingsPage({ payload, poll, league: league.id });
}
