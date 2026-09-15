import type {
  CoverageNote,
  PollId,
  RankTrend,
  RankingPoll,
  RankingRow,
  RankingsResponse,
} from "@/lib/types";

const ESPN_WEB =
  process.env.ESPN_WEB_BASE ??
  "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_SITE =
  process.env.ESPN_SITE_BASE ??
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

const FETCH_TIMEOUT_MS = 12_000;

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

const POLL_IDS = new Set<PollId>(POLL_TABS.map((tab) => tab.id));

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

function teamLogo(teamId: string): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

function hexColor(value: unknown): string | null {
  const raw = str(value).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toLowerCase()}`;
}

export function parsePollParam(value: string | null | undefined): PollId {
  const slug = str(value).trim().toLowerCase();
  if (POLL_IDS.has(slug as PollId)) return slug as PollId;
  return "ap";
}

export function rankingsHref(poll: PollId): string {
  return poll === "ap" ? "/rankings" : `/rankings?poll=${poll}`;
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

function parseRow(raw: unknown): RankingRow | null {
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
      logo: str(team.logo) || teamLogo(id),
      color: hexColor(team.color),
    },
  };
}

function emptyPoll(id: PollId): RankingPoll {
  const tab = POLL_TABS.find((item) => item.id === id) ?? POLL_TABS[0];
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

function parsePoll(raw: unknown): RankingPoll | null {
  const poll = asRecord(raw);
  if (!poll) return null;
  const id = pollIdFromEspn(poll);
  if (!id) return null;
  const occurrence = asRecord(poll.occurrence);
  const ranks = asArray(poll.ranks)
    .map(parseRow)
    .filter((row): row is RankingRow => Boolean(row))
    .sort((a, b) => a.rank - b.rank);
  const tab = POLL_TABS.find((item) => item.id === id);
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

export function parseRankingsPayload(payload: unknown): RankingPoll[] {
  const root = asRecord(payload) ?? {};
  const byId = new Map<PollId, RankingPoll>();
  for (const raw of asArray(root.rankings)) {
    const poll = parsePoll(raw);
    if (!poll) continue;
    byId.set(poll.id, poll);
  }
  return POLL_TABS.map((tab) => byId.get(tab.id)).filter((poll): poll is RankingPoll => Boolean(poll));
}

function coverageFor(polls: RankingPoll[]): CoverageNote {
  const live = polls.filter((poll) => poll.ranks.length > 0).map((poll) => poll.shortName);
  return {
    headline: "Rankings from ESPN public poll feed",
    detail:
      live.length > 0
        ? `${live.join(", ")} come from ESPN’s unofficial college-football /rankings JSON. Points and trends are whatever ESPN published — this app does not fabricate poll points.`
        : "ESPN’s public /rankings JSON did not include a ranked poll. No sample points are shown.",
  };
}

export function assembleRankingsPage({
  payload,
  poll,
  now = new Date(),
}: {
  payload: unknown;
  poll: PollId;
  now?: Date;
}): RankingsResponse {
  const parsed = parseRankingsPayload(payload);
  const byId = new Map(parsed.map((item) => [item.id, item]));
  const polls = POLL_TABS.map((tab) => byId.get(tab.id) ?? emptyPoll(tab.id));
  const requested = parsePollParam(poll);
  const selected = polls.find((item) => item.id === requested) ?? polls[0] ?? null;
  const root = asRecord(payload) ?? {};
  const season = asRecord(root.requestedSeason) ?? asRecord(root.latestSeason);
  const seasonWeek = asRecord(season?.week) ?? asRecord(root.latestWeek);
  return {
    source: "espn",
    demo: false,
    generatedAt: now.toISOString(),
    week: num(seasonWeek?.number) ?? selected?.week ?? null,
    seasonYear: num(season?.year),
    poll: selected?.id ?? "ap",
    polls,
    selected,
    coverage: coverageFor(polls),
  };
}

async function espnGet(path: string): Promise<Json> {
  const bases = [ESPN_WEB, ESPN_SITE];
  let lastError: Error | null = null;
  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}${path}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "HarmonLine/1.0 (college football scoreboard; +https://localhost)",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`ESPN ${response.status} from ${base}`);
        continue;
      }
      const data = asRecord(await response.json());
      if (!data) {
        lastError = new Error("ESPN returned a non-object payload");
        continue;
      }
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("Unable to reach ESPN public APIs");
}

export async function getRankings(poll: PollId = "ap"): Promise<RankingsResponse> {
  const payload = await espnGet("/rankings");
  return assembleRankingsPage({ payload, poll });
}
