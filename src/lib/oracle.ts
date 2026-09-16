import { gameHref, sportBoardHref, sportOracleHref, sportRankingsHref } from "@/lib/board-url";
import { todayEspnDate } from "@/lib/dates";
import { getGameDetail, getScoreboard } from "@/lib/espn";
import { getRankings } from "@/lib/espn-rankings";
import { getTeamPage } from "@/lib/espn-team";
import {
  cfbdKeyConfigured,
  cfbdTeamQueryName,
  fetchCfbdSeasonStats,
} from "@/lib/cfbd";
import {
  createGeminiGroundingClient,
  evidenceLinesFromCitations,
  geminiConfigured,
  type GeminiGroundingResult,
} from "@/lib/gemini-grounding";
import { DEFAULT_LEAGUE, getLeague, parseLeagueParam } from "@/lib/leagues";
import { BETTING_DISCLAIMER_LONG } from "@/lib/sim";
import type {
  GameDetailResponse,
  GameSummary,
  LeagueId,
  RankingsResponse,
  RankingRow,
  ScoreboardResponse,
  TeamPageResponse,
  TeamSeasonStats,
  TeamSide,
} from "@/lib/types";

export const ORACLE_VERSION = "stat-oracle-gemini-v0";
export const ESPN_ONLY_NOTE =
  "This install is ESPN-slice only. Historical / off-feed questions need GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY in .env.local (Gemini + Google Search grounding — not a Custom Search Engine id).";

export type OracleIntent =
  | "score"
  | "record"
  | "rank"
  | "leaders"
  | "situation"
  | "schedule"
  | "stats"
  | "forecast"
  | "slate"
  | "betting"
  | "video"
  | "unknown";

export type OracleParse = {
  query: string;
  league: LeagueId;
  intent: OracleIntent;
  needles: string[];
  eventId: string | null;
  betting: boolean;
  wantsVideo: boolean;
};

export type OracleSourceKind =
  | "espn-scoreboard"
  | "espn-summary"
  | "espn-rankings"
  | "espn-team"
  | "cfbd"
  | "google-grounding";

export type OracleSource = {
  label: string;
  href?: string | null;
  kind: OracleSourceKind;
};

export type OracleScope =
  | "game"
  | "team"
  | "rankings"
  | "scoreboard"
  | "empty"
  | "refused"
  | "grounded";

export type OracleResponse = {
  source: "espn" | "gemini";
  demo: false;
  query: string;
  league: LeagueId;
  generatedAt: string;
  scope: OracleScope;
  honesty: { headline: string; detail: string };
  evidence: string[];
  inference: string[];
  answerMarkdown: string;
  sources: OracleSource[];
  rgDisclaimer: string | null;
  geminiConfigured: boolean;
  simulation: boolean;
};

export type OracleFeeds = {
  getScoreboard: (opts: { league: LeagueId }) => Promise<ScoreboardResponse>;
  getGameDetail: (eventId: string, league: LeagueId) => Promise<GameDetailResponse>;
  getTeamPage: (teamId: string, league: LeagueId) => Promise<TeamPageResponse>;
  getRankings: (poll: "ap", league: LeagueId) => Promise<RankingsResponse>;
  cfbdConfigured: boolean;
  getCfbdSeasonStats: (teamName: string, year: number) => Promise<Partial<TeamSeasonStats>>;
  geminiConfigured: boolean;
  askGemini?: (question: string) => Promise<GeminiGroundingResult>;
};

export function oracleAskLabel(groundingEnabled: boolean): string {
  return groundingEnabled ? "ASK GOOGLE" : "ASK ESPN";
}

const BETTING_RE =
  /\b(ats|against the spread|cover(?:s|ed|ing)?(?:\s+the)?\s+spread|the spread|moneyline|\bml\b|over\/?under|o\/u|parlay|teaser|pick'?em|odds|vig|juice|polymarket|pickcenter|winprob|win probability|should i bet|wager|best bet|unit bet|paid odds)\b/i;

const VIDEO_RE = /\b(highlights?|youtube|clip|film|video)\b/i;

const STOP = new Set([
  "whats",
  "what's",
  "what",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "score",
  "scores",
  "record",
  "ranked",
  "rank",
  "ranking",
  "rankings",
  "where",
  "who",
  "won",
  "winning",
  "will",
  "win",
  "game",
  "tonight",
  "today",
  "this",
  "week",
  "please",
  "tell",
  "me",
  "about",
  "vs",
  "versus",
  "at",
  "how",
  "did",
  "does",
  "for",
  "of",
  "in",
  "on",
  "to",
  "and",
  "or",
  "led",
  "leader",
  "leaders",
  "ppg",
  "points",
  "per",
  "their",
  "current",
  "live",
  "final",
  "kickoff",
  "spread",
  "cover",
  "covers",
  "poll",
  "ap",
  "top",
  "25",
  "season",
  "stat",
  "stats",
  "situation",
  "schedule",
  "next",
  "upcoming",
  "forecast",
  "predict",
]);

const ENTITY_HINTS: Array<{ pattern: RegExp; league: LeagueId; needle: string }> = [
  { pattern: /\blakers\b/i, league: "nba", needle: "lakers" },
  { pattern: /\bceltics\b/i, league: "nba", needle: "celtics" },
  { pattern: /\bknicks\b/i, league: "nba", needle: "knicks" },
  { pattern: /\bwarriors\b/i, league: "nba", needle: "warriors" },
  { pattern: /\bnuggets\b/i, league: "nba", needle: "nuggets" },
  { pattern: /\b(nfl|super bowl|\bafc\b|\bnfc\b)\b/i, league: "nfl", needle: "" },
  { pattern: /\bchiefs\b/i, league: "nfl", needle: "chiefs" },
  { pattern: /\beagles\b/i, league: "nfl", needle: "eagles" },
  { pattern: /\bcowboys\b/i, league: "nfl", needle: "cowboys" },
  { pattern: /\bbills\b/i, league: "nfl", needle: "bills" },
  { pattern: /\bpackers\b/i, league: "nfl", needle: "packers" },
  { pattern: /\bpatriots\b/i, league: "nfl", needle: "patriots" },
  { pattern: /\b(niners|49ers)\b/i, league: "nfl", needle: "49ers" },
  { pattern: /\byankees\b/i, league: "mlb", needle: "yankees" },
  { pattern: /\bdodgers\b/i, league: "mlb", needle: "dodgers" },
  { pattern: /\bmets\b/i, league: "mlb", needle: "mets" },
  { pattern: /\bcubs\b/i, league: "mlb", needle: "cubs" },
  { pattern: /\bred sox\b/i, league: "mlb", needle: "red sox" },
  { pattern: /\b(mlb|world series)\b/i, league: "mlb", needle: "" },
  { pattern: /\b(nba)\b/i, league: "nba", needle: "" },
  { pattern: /\b(mbb|cbb|march madness|college basketball)\b/i, league: "mbb", needle: "" },
  { pattern: /\b(cfb|ncaaf|college football)\b/i, league: "cfb", needle: "" },
  { pattern: /\b(bama|alabama)\b/i, league: "cfb", needle: "alabama" },
  { pattern: /\b(buckeyes|ohio state|ohio st\.?)\b/i, league: "cfb", needle: "ohio state" },
  { pattern: /\bwolverines\b/i, league: "cfb", needle: "michigan" },
  { pattern: /\blonghorns\b/i, league: "cfb", needle: "texas" },
  { pattern: /\b(uga|georgia)\b/i, league: "cfb", needle: "georgia" },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function phraseNeedle(raw: string): string {
  return raw
    .replace(/['’]s\b/gi, "")
    .replace(/[?!.,'’]/g, " ")
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1 && !STOP.has(token))
    .join(" ")
    .trim();
}

function uniqueNeedles(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const n = normalize(value);
    if (!n || n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function isBettingQuestion(q: string): boolean {
  return BETTING_RE.test(q);
}

function intentFrom(q: string, betting: boolean, needles: string[]): OracleIntent {
  if (betting) return "betting";
  if (VIDEO_RE.test(q)) return "video";
  if (/\bwho will win\b|\bwho wins\b|\bpredict\b|\bforecast\b/i.test(q)) return "forecast";
  if (/\brank(?:ed|ing|ings)?\b|\bap poll\b|\btop 25\b/i.test(q)) return "rank";
  if (/\bleader|who led|passing|rushing yards/i.test(q)) return "leaders";
  if (/\bpoints per game\b|\bppg\b|\byards per game\b|season stat/i.test(q)) return "stats";
  if (/\brecord\b|wins and losses/i.test(q)) return "record";
  if (/\bschedule\b|next game|upcoming/i.test(q)) return "schedule";
  if (/\bsituation\b|down and distance|red zone|possession/i.test(q)) return "situation";
  if (/\bscore|final|who won|kickoff/i.test(q)) return "score";
  if (needles.length > 0) return "score";
  return "unknown";
}

export function parseOracleQuestion(q: string, leagueHint?: LeagueId | string | null): OracleParse {
  const query = (q ?? "").trim();
  const hinted = parseLeagueParam(leagueHint);
  let league = hinted;
  const needles: string[] = [];
  for (const hint of ENTITY_HINTS) {
    if (!hint.pattern.test(query)) continue;
    league = hint.league;
    if (hint.needle) needles.push(hint.needle);
  }
  const vs = query.match(/(.+?)\s+(?:vs\.?|versus|@)\s+(.+)/i);
  if (vs) {
    needles.push(phraseNeedle(vs[1] ?? ""), phraseNeedle(vs[2] ?? ""));
  } else {
    const leftover = phraseNeedle(query);
    if (leftover) needles.push(leftover);
  }
  const eventMatch = query.match(/\b(401\d{6,})\b/);
  const betting = isBettingQuestion(query);
  const unique = uniqueNeedles(needles);
  return {
    query,
    league,
    intent: intentFrom(query, betting, unique),
    needles: unique,
    eventId: eventMatch?.[1] ?? null,
    betting,
    wantsVideo: VIDEO_RE.test(query),
  };
}

function teamHaystack(team: TeamSide): string {
  return normalize(`${team.name} ${team.shortName} ${team.abbreviation}`);
}

function teamMatchesNeedle(team: TeamSide, needle: string): boolean {
  const n = normalize(needle);
  if (!n) return false;
  const hay = teamHaystack(team);
  return hay === n || hay.includes(n) || n.includes(normalize(team.abbreviation));
}

function gameMatches(game: GameSummary, needles: string[], eventId: string | null): boolean {
  if (eventId && game.id === eventId) return true;
  if (needles.length >= 2) {
    const [a, b] = needles;
    return (
      (teamMatchesNeedle(game.away, a) && teamMatchesNeedle(game.home, b)) ||
      (teamMatchesNeedle(game.home, a) && teamMatchesNeedle(game.away, b))
    );
  }
  if (needles.length === 1) {
    return teamMatchesNeedle(game.home, needles[0]) || teamMatchesNeedle(game.away, needles[0]);
  }
  return false;
}

function gameRank(game: GameSummary): number {
  if (game.status.state === "in") return 0;
  if (game.status.state === "post") return 1;
  return 2;
}

function pickGame(games: GameSummary[], needles: string[], eventId: string | null): GameSummary | null {
  const matches = games.filter((row) => gameMatches(row, needles, eventId));
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => gameRank(a) - gameRank(b) || a.name.localeCompare(b.name))[0] ?? null;
}

function rankingRowMatches(row: RankingRow, needles: string[]): boolean {
  const hay = normalize(`${row.team.name} ${row.team.abbreviation}`);
  return needles.some((needle) => {
    const n = normalize(needle);
    return n.length >= 2 && (hay.includes(n) || n.includes(normalize(row.team.abbreviation)));
  });
}

function publishedScoreLine(game: GameSummary): string {
  const away = game.away.score;
  const home = game.home.score;
  const stamp = game.status.shortDetail || game.status.detail;
  const prePlaceholder = game.status.state === "pre" && away === 0 && home === 0;
  if (away != null && home != null && !prePlaceholder) {
    return `${game.away.shortName} ${away}, ${game.home.shortName} ${home} — ${stamp}`;
  }
  return `${game.away.shortName} at ${game.home.shortName} — ${stamp}. Scores are not published on this ESPN feed yet.`;
}

function recordLine(team: TeamSide): string | null {
  if (!team.record) return null;
  return `${team.shortName} record ${team.record}`;
}

function rankLine(team: TeamSide): string | null {
  if (team.rank == null) return null;
  return `${team.shortName} listed at #${team.rank} on this ESPN slice`;
}

function markdown(
  evidence: string[],
  inference: string[],
  extra = "",
  source: OracleResponse["source"] = "espn"
): string {
  const ev =
    evidence.length > 0
      ? evidence.map((line) => `- ${line}`).join("\n")
      : "- None. Named game/team is not on this feed.";
  const inf =
    inference.length > 0
      ? inference.map((line) => `- ${line}`).join("\n")
      : "- No inference. Stat Oracle v0 does not invent scores, percentiles, sample sizes, or video.";
  const evidenceLabel =
    source === "gemini"
      ? "**Evidence** (Google Search grounding citations/snippets/URLs — never invented)"
      : "**Evidence** (public ESPN cells only — never invented)";
  const inferenceLabel =
    source === "gemini"
      ? "**Inference** (model synthesis; SIMULATION when speculative — not a score we invented)"
      : "**Inference** (labeled restatement, not a live score we created)";
  const footer =
    source === "gemini"
      ? "_Stat Oracle v0 used Gemini with Google Search grounding. It is not StatMuse SQL._"
      : "_Stat Oracle v0 reads one ESPN scoreboard/summary slice. It is not StatMuse SQL._";
  return `${evidenceLabel}\n\n${ev}\n\n${inferenceLabel}\n\n${inf}${extra ? `\n\n${extra}` : ""}\n\n${footer}`;
}

function emptyAnswer(
  query: string,
  league: LeagueId,
  inference: string[],
  generatedAt: string,
  groundingEnabled: boolean
): OracleResponse {
  const note = groundingEnabled
    ? "Stat Oracle v0 answers from a fetched ESPN scoreboard or summary slice, then Gemini + Google Search grounding when a key is set. This named game/team is not on this feed and Google did not return a grounded answer. Scores, percentiles, sample sizes, and video are never invented."
    : `Stat Oracle v0 answers from a fetched ESPN scoreboard or summary slice. This named game/team is not on this feed. Scores, percentiles, sample sizes, and video are never invented. ${ESPN_ONLY_NOTE}`;
  const lines = groundingEnabled ? inference : [...inference, ESPN_ONLY_NOTE];
  return {
    source: "espn",
    demo: false,
    query,
    league,
    generatedAt,
    scope: "empty",
    honesty: {
      headline: "NOT ON THIS FEED",
      detail: note,
    },
    evidence: [],
    inference: lines,
    answerMarkdown: markdown([], lines),
    sources: [],
    rgDisclaimer: null,
    geminiConfigured: groundingEnabled,
    simulation: false,
  };
}

function geminiAnswer(
  query: string,
  league: LeagueId,
  generatedAt: string,
  result: GeminiGroundingResult
): OracleResponse {
  const evidence = evidenceLinesFromCitations(result.citations);
  const grounded = result.grounded && evidence.length > 0;
  const simulation = !grounded;
  const synthesis = result.text.trim();
  const inference = simulation
    ? [
        synthesis
          ? `SIMULATION: ${synthesis} Google Search grounding did not attach citation URLs, so this is speculative synthesis — not a published score.`
          : "SIMULATION: Gemini did not return a grounded answer. Scores and champions are never invented.",
      ]
    : [
        synthesis
          ? `INFERENCE: ${synthesis}`
          : "INFERENCE: Grounded citations are listed as Evidence. Synthesis is labeled and is not a score we invented.",
      ];
  const sources: OracleSource[] = result.citations.map((citation) => ({
    label: citation.title || citation.uri,
    href: citation.uri,
    kind: "google-grounding",
  }));
  return {
    source: "gemini",
    demo: false,
    query,
    league,
    generatedAt,
    scope: grounded ? "grounded" : "empty",
    honesty: {
      headline: grounded ? "EVIDENCE FROM GOOGLE SEARCH GROUNDING" : "UNGROUNDED SYNTHESIS",
      detail: grounded
        ? "Evidence is copied from Gemini Google Search grounding metadata (citations, snippets, URLs). Inference is model synthesis, not a live score we invented."
        : "Gemini returned text without grounding citation URLs. Inference is labeled SIMULATION. Scores and champions are never invented.",
    },
    evidence: grounded ? evidence : [],
    inference,
    answerMarkdown: markdown(grounded ? evidence : [], inference, "", "gemini"),
    sources: grounded ? sources : [],
    rgDisclaimer: null,
    geminiConfigured: true,
    simulation,
  };
}

export function createDefaultOracleFeeds(): OracleFeeds {
  return {
    getScoreboard: async ({ league }) => {
      const spec = getLeague(league);
      const date = todayEspnDate();
      return getScoreboard({
        league,
        division: "d1",
        date,
        subdivision: "all",
        view: spec.navMode === "week" ? "week" : "date",
      });
    },
    getGameDetail,
    getTeamPage,
    getRankings: (poll, league) => getRankings(poll, league),
    cfbdConfigured: cfbdKeyConfigured(),
    getCfbdSeasonStats: async (teamName, year) => {
      const key = process.env.CFBD_API_KEY?.trim();
      if (!key) return {};
      return fetchCfbdSeasonStats(cfbdTeamQueryName(teamName, teamName), year, key);
    },
    geminiConfigured: geminiConfigured(),
    askGemini: geminiConfigured()
      ? async (question) => {
          const client = createGeminiGroundingClient();
          if (!client) throw new Error("Gemini is not configured");
          return client.generate(question);
        }
      : undefined,
  };
}

async function tryGeminiAnswer(
  query: string,
  league: LeagueId,
  generatedAt: string,
  feeds: OracleFeeds
): Promise<OracleResponse | null> {
  if (!feeds.geminiConfigured || !feeds.askGemini) return null;
  try {
    const result = await feeds.askGemini(query);
    if (!result.grounded && !result.text.trim()) return null;
    return geminiAnswer(query, league, generatedAt, result);
  } catch {
    return null;
  }
}

export async function answerOracle(
  input: { q: string; league?: LeagueId | string | null },
  feeds: OracleFeeds = createDefaultOracleFeeds()
): Promise<OracleResponse> {
  const generatedAt = new Date().toISOString();
  const parsed = parseOracleQuestion(input.q, input.league);
  const spec = getLeague(parsed.league);
  const groundingEnabled = feeds.geminiConfigured;

  if (!parsed.query) {
    return emptyAnswer(
      "",
      parsed.league,
      [
        "Ask a named game or team on a Harmon Line league (CFB / MBB / NFL / NBA / MLB). Stat Oracle v0 is not StatMuse SQL.",
      ],
      generatedAt,
      groundingEnabled
    );
  }

  if (parsed.intent === "betting") {
    const inference = [
      "REFUSED: The Harmon Line does not give betting advice. Ask a score, record, rank, or leader question instead.",
    ];
    return {
      source: "espn",
      demo: false,
      query: parsed.query,
      league: parsed.league,
      generatedAt,
      scope: "refused",
      honesty: {
        headline: "BETTING ADVICE REFUSED",
        detail: "Stat Oracle v0 will not answer betting questions. Ask a published score, record, rank, or leader instead.",
      },
      evidence: [],
      inference,
      answerMarkdown: markdown([], inference),
      sources: [],
      rgDisclaimer: BETTING_DISCLAIMER_LONG,
      geminiConfigured: groundingEnabled,
      simulation: false,
    };
  }

  if (parsed.intent === "video" || parsed.wantsVideo) {
    return emptyAnswer(
      parsed.query,
      parsed.league,
      [
        "Highlights live on the home-board YouTube strip, not in Stat Oracle. Video ids and clips are never invented here.",
      ],
      generatedAt,
      groundingEnabled
    );
  }

  let board: ScoreboardResponse | null = null;
  try {
    board = await feeds.getScoreboard({ league: parsed.league });
  } catch {
    const grounded = await tryGeminiAnswer(parsed.query, parsed.league, generatedAt, feeds);
    if (grounded) return grounded;
    return emptyAnswer(
      parsed.query,
      parsed.league,
      ["ESPN scoreboard was not reachable. Live scores are never invented."],
      generatedAt,
      groundingEnabled
    );
  }

  const sources: OracleSource[] = [
    {
      label: `ESPN ${spec.sport}/${spec.league} scoreboard`,
      href: sportBoardHref(parsed.league),
      kind: "espn-scoreboard",
    },
  ];

  const matched = pickGame(board.games, parsed.needles, parsed.eventId);
  let detail: GameDetailResponse | null = null;
  if (
    matched &&
    (parsed.intent === "leaders" || parsed.intent === "situation" || parsed.eventId)
  ) {
    try {
      detail = await feeds.getGameDetail(matched.id, parsed.league);
      sources.push({
        label: `ESPN summary event ${matched.id}`,
        href: gameHref(matched.id, parsed.league),
        kind: "espn-summary",
      });
    } catch {
      detail = null;
    }
  }

  let rankRow: RankingRow | null = null;
  if (parsed.intent === "rank" && spec.rankings) {
    try {
      const rankings = await feeds.getRankings("ap", parsed.league);
      const rows = rankings.selected?.ranks ?? [];
      rankRow = rows.find((row) => rankingRowMatches(row, parsed.needles)) ?? null;
      if (rankRow) {
        sources.push({
          label: rankings.selected?.name ?? "ESPN rankings",
          href: sportRankingsHref(parsed.league),
          kind: "espn-rankings",
        });
        const evidence: string[] = [];
        evidence.push(
          `${rankRow.team.name} is #${rankRow.rank} in ${rankings.selected?.name ?? "this poll"}` +
            (rankings.selected?.week ? ` (week ${rankings.selected.week})` : "")
        );
        if (rankRow.points != null) evidence.push(`Poll points ${rankRow.points} as published by ESPN`);
        if (rankRow.record) evidence.push(`Record ${rankRow.record} on this poll row`);
        if (rankRow.trend.label) evidence.push(`Trend ${rankRow.trend.label} (only because ESPN sent it)`);
        const inference = [
          "INFERENCE: Rank is copied from the public ESPN poll JSON. Missing points stay blank. Polls are never sampled.",
        ];
        return {
          source: "espn",
          demo: false,
          query: parsed.query,
          league: parsed.league,
          generatedAt,
          scope: "rankings",
          honesty: {
            headline: "EVIDENCE FROM ESPN RANKINGS",
            detail: rankings.coverage.detail,
          },
          evidence,
          inference,
          answerMarkdown: markdown(evidence, inference),
          sources,
          rgDisclaimer: null,
          geminiConfigured: groundingEnabled,
          simulation: false,
        };
      }
    } catch {
      rankRow = null;
    }
  }

  const evidence: string[] = [];
  const inference: string[] = [];
  let scope: OracleScope = "empty";

  if (matched) {
    scope = "game";
    sources[0] = {
      ...sources[0],
      href: gameHref(matched.id, parsed.league),
    };
    evidence.push(publishedScoreLine(matched));
    if (matched.broadcast) evidence.push(`Broadcast ${matched.broadcast}`);
    if (matched.venue) {
      evidence.push(matched.venueCity ? `${matched.venue} (${matched.venueCity})` : matched.venue);
    }
    const awayRecord = recordLine(matched.away);
    const homeRecord = recordLine(matched.home);
    if (awayRecord) evidence.push(awayRecord);
    if (homeRecord) evidence.push(homeRecord);
    const awayRank = rankLine(matched.away);
    const homeRank = rankLine(matched.home);
    if (awayRank) evidence.push(awayRank);
    if (homeRank) evidence.push(homeRank);
    if (matched.situation?.downDistanceText) {
      evidence.push(`Situation ${matched.situation.downDistanceText}`);
    } else if (parsed.intent === "situation") {
      inference.push("INFERENCE: ESPN did not publish a down-and-distance snapshot on this slice.");
    }
    const leaders = detail?.leaders ?? [];
    for (const leader of leaders) {
      if (!leader.name || !leader.displayValue) continue;
      evidence.push(`${leader.name}: ${leader.displayValue} (${leader.category})`);
    }
    if (parsed.intent === "leaders" && leaders.length === 0) {
      inference.push("INFERENCE: ESPN did not publish game leaders on this summary. Names are never fabricated.");
    }
    if (parsed.intent === "forecast") {
      inference.push(
        "INFERENCE: Stat Oracle v0 does not forecast winners. SIMULATION lives on CFB Deep Dive and is not a live score."
      );
    } else {
      inference.push(
        `INFERENCE: Copied from the public ESPN ${spec.shortLabel} scoreboard/summary. Not a score we invented.`
      );
    }
  }

  if (parsed.intent === "stats" && feeds.cfbdConfigured && parsed.league === "cfb") {
    const teamName =
      matched && parsed.needles[0]
        ? teamMatchesNeedle(matched.away, parsed.needles[0])
          ? matched.away.name
          : matched.home.name
        : parsed.needles[0];
    if (teamName) {
      const year = board.seasonYear ?? new Date().getUTCFullYear();
      const stats = await feeds.getCfbdSeasonStats(teamName, year);
      if (stats.pointsPerGame != null) {
        evidence.push(`${teamName} points per game ${stats.pointsPerGame} (CFBD fill of a blank ESPN cell)`);
        sources.push({ label: "CollegeFootballData season stats", kind: "cfbd" });
        if (scope === "empty") scope = "team";
      } else {
        inference.push("INFERENCE: CFBD key is set but this school did not match a published season-stat row. No CFBD cells were invented.");
      }
    }
  }

  if (scope === "empty") {
    const grounded = await tryGeminiAnswer(parsed.query, parsed.league, generatedAt, feeds);
    if (grounded) return grounded;
    return emptyAnswer(
      parsed.query,
      parsed.league,
      [
        "Named game or team is not on this feed. Stat Oracle v0 does not invent scores, percentiles, sample sizes, or video.",
      ],
      generatedAt,
      groundingEnabled
    );
  }

  return {
    source: "espn",
    demo: false,
    query: parsed.query,
    league: parsed.league,
    generatedAt,
    scope,
    honesty: {
      headline: "EVIDENCE FROM ESPN PUBLIC JSON",
      detail:
        "Numbers below are copied from a fetched scoreboard or summary slice. Missing cells stay blank. Inference is labeled and is not a live score.",
    },
    evidence,
    inference,
    answerMarkdown: markdown(evidence, inference),
    sources,
    rgDisclaimer: null,
    geminiConfigured: groundingEnabled,
    simulation: parsed.intent === "forecast",
  };
}

export function oracleQuestionForGame(game: {
  away: { shortName: string };
  home: { shortName: string };
}): string {
  return `${game.away.shortName} vs ${game.home.shortName}`;
}

export function oracleHrefForGame(
  game: { away: { shortName: string }; home: { shortName: string } },
  league: LeagueId = DEFAULT_LEAGUE
): string {
  return sportOracleHref(league, oracleQuestionForGame(game));
}
