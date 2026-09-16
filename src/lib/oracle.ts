import { sportOracleHref } from "@/lib/board-url";
import {
  cfbdKeyConfigured,
  cfbdTeamQueryName,
  fetchCfbdSeasonStats,
  mergeCfbdStats,
} from "@/lib/cfbd";
import { todayEspnDate } from "@/lib/dates";
import { getGameDetail, getScoreboard } from "@/lib/espn";
import { espnGet } from "@/lib/espn-http";
import { getRankings } from "@/lib/espn-rankings";
import { parseTeamSeasonStats } from "@/lib/espn-stats";
import { getTeamPage } from "@/lib/espn-team";
import { getLeague, parseLeagueParam } from "@/lib/leagues";
import { BETTING_DISCLAIMER, BETTING_DISCLAIMER_LONG } from "@/lib/sim";
import type {
  GameSummary,
  LeaderLine,
  LeagueId,
  OracleEvidenceItem,
  OracleInferenceItem,
  OracleIntent,
  OracleResponse,
  RankingPoll,
  RankingRow,
  TeamProfile,
  TeamScheduleGame,
  TeamSeasonStats,
  TeamSide,
} from "@/lib/types";

export const ORACLE_MODEL_VERSION = "harmon-line-oracle-v0";

export type ParsedOracleQuestion = {
  intents: OracleIntent[];
  bettingAdjacent: boolean;
  normalized: string;
};

export type OracleData = {
  game: GameSummary | null;
  leaders: LeaderLine[];
  team: TeamProfile | null;
  recent: TeamScheduleGame[];
  upcoming: TeamScheduleGame[];
  rankings: RankingPoll | null;
  homeStats: TeamSeasonStats | null;
  awayStats: TeamSeasonStats | null;
  teamStats: TeamSeasonStats | null;
  cfbdFilled: string[];
  cfbdConfigured: boolean;
  endpoints: string[];
};

export type ParsedOracleRequest = {
  question: string;
  league: LeagueId;
  gameId: string | null;
  teamId: string | null;
};

const BETTING_RE =
  /\b(bet|betting|wager|odds|spread|ats|against the spread|moneyline|money line|parlay|lock|units?|juice|vig|covers?|covering|pickcenter|winprob|implied)\b/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function numericId(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  return /^\d+$/.test(raw) ? raw : null;
}

export function emptyOracleData(): OracleData {
  return {
    game: null,
    leaders: [],
    team: null,
    recent: [],
    upcoming: [],
    rankings: null,
    homeStats: null,
    awayStats: null,
    teamStats: null,
    cfbdFilled: [],
    cfbdConfigured: false,
    endpoints: [],
  };
}

export function parseOracleRequest(input: {
  question?: string | null;
  q?: string | null;
  league?: string | null;
  gameId?: string | null;
  teamId?: string | null;
}): ParsedOracleRequest {
  return {
    question: (input.question ?? input.q ?? "").trim(),
    league: parseLeagueParam(input.league),
    gameId: numericId(input.gameId),
    teamId: numericId(input.teamId),
  };
}

export function parseOracleQuestion(question: string): ParsedOracleQuestion {
  const normalized = normalize(question);
  const bettingAdjacent = BETTING_RE.test(question) || BETTING_RE.test(normalized);
  const intents: OracleIntent[] = [];
  if (bettingAdjacent) intents.push("betting");
  if (/\b(score|scoring|winning|losing|how many points)\b/.test(normalized)) intents.push("score");
  if (/\b(who won|winner|who beat|beat|final)\b/.test(normalized)) intents.push("winner");
  if (/\b(record|win loss|wins and losses)\b/.test(normalized)) intents.push("record");
  if (/\b(rank|ranked|ranking|rankings|poll)\b/.test(normalized)) intents.push("rank");
  if (/\b(lead|leads|leader|leaders|leading|passing yards|rushing yards)\b/.test(normalized)) {
    intents.push("leaders");
  }
  if (/\b(down and|distance|possession|red zone|situation)\b/.test(normalized)) {
    intents.push("situation");
  }
  if (/\b(next game|upcoming|when do they play|last game|schedule)\b/.test(normalized)) {
    intents.push("schedule");
  }
  if (
    /\b(ppg|points per game|yards per|season stats|offense|sample size|percentile)\b/.test(
      normalized
    )
  ) {
    intents.push("stats");
  }
  if (/\b(better|who wins|who should win|on paper|matchup)\b/.test(normalized)) {
    intents.push("comparison");
  }
  if (intents.length === 0 || (intents.length === 1 && intents[0] === "betting")) {
    if (!intents.includes("general") && !bettingAdjacent) intents.push("general");
  }
  return { intents, bettingAdjacent, normalized };
}

function mentionsTeam(
  question: string,
  team: { name: string; shortName: string; abbreviation: string }
): boolean {
  const q = normalize(question);
  if (!q) return false;
  const tokens = new Set(q.split(" ").filter(Boolean));
  const abbr = team.abbreviation.toLowerCase();
  const short = normalize(team.shortName);
  const name = normalize(team.name);
  if (abbr.length >= 2 && tokens.has(abbr)) return true;
  if (short && q.includes(short)) return true;
  if (name && q.includes(name)) return true;
  return false;
}

export function matchGamesForQuestion(question: string, games: GameSummary[]): GameSummary[] {
  const both = games.filter(
    (game) => mentionsTeam(question, game.home) && mentionsTeam(question, game.away)
  );
  if (both.length > 0) return both;
  return games.filter(
    (game) => mentionsTeam(question, game.home) || mentionsTeam(question, game.away)
  );
}

function matchRankRows(question: string, poll: RankingPoll): RankingRow[] {
  return poll.ranks.filter((row) => mentionsTeam(question, { ...row.team, shortName: row.team.name }));
}

function wants(intents: OracleIntent[], intent: OracleIntent): boolean {
  if (intents.includes(intent)) return true;
  if (intents.includes("general")) {
    return intent === "score" || intent === "record" || intent === "rank";
  }
  return false;
}

function scoreLine(game: GameSummary): string | null {
  if (game.away.score == null || game.home.score == null) return null;
  return `${game.away.shortName} ${game.away.score}–${game.home.score} ${game.home.shortName} · ${game.status.shortDetail}`;
}

function publishedWinner(game: GameSummary): TeamSide | null {
  if (game.home.winner) return game.home;
  if (game.away.winner) return game.away;
  return null;
}

function isPositiveEvidence(text: string): boolean {
  return !/not on this feed|not published|not final|cannot verify|does not use odds|does not publish|never invented/i.test(
    text
  );
}

function pushObserved(
  evidence: OracleEvidenceItem[],
  text: string,
  field?: string
): void {
  if (evidence.some((row) => row.text === text)) return;
  evidence.push(field ? { kind: "observed", text, field } : { kind: "observed", text });
}

function formatScheduleGame(game: TeamScheduleGame, teamName: string): string {
  if (game.result && game.teamScore != null && game.opponentScore != null) {
    return `${teamName} ${game.result} ${game.teamScore}–${game.opponentScore} vs ${game.opponent.name} · ${game.shortDetail}`;
  }
  return `${teamName} vs ${game.opponent.name} · ${game.shortDetail}`;
}

async function settledEspn(path: string, league: LeagueId): Promise<unknown> {
  try {
    return await espnGet(path, league);
  } catch {
    return {};
  }
}

export function answerOracle(input: {
  question: string;
  league: LeagueId;
  data: OracleData;
  now?: Date;
}): OracleResponse {
  const question = input.question.trim();
  const parsed = parseOracleQuestion(question);
  const { game, leaders, team, recent, upcoming, rankings } = input.data;
  const evidence: OracleEvidenceItem[] = [];
  const inference: OracleInferenceItem[] = [];
  const headlines: string[] = [];
  const summaries: string[] = [];
  const missingNotes: string[] = [];

  if (input.data.cfbdFilled.length > 0) {
    pushObserved(
      evidence,
      `CFBD filled ${input.data.cfbdFilled.join(", ")} (blank ESPN cell${
        input.data.cfbdFilled.length === 1 ? "" : "s"
      })`,
      "cfbd"
    );
  }

  if (parsed.bettingAdjacent) {
    pushObserved(
      evidence,
      "The Harmon Line Stat Oracle does not use odds, spreads, or ATS. Those markets are not on this feed.",
      "betting"
    );
    summaries.push("The Harmon Line does not publish odds, spreads, or ATS.");
  }

  if (wants(parsed.intents, "score") && game) {
    const line = scoreLine(game);
    if (line) {
      pushObserved(evidence, `ESPN score: ${line}`, "score");
      headlines.push(`${game.away.shortName} ${game.away.score} · ${game.home.shortName} ${game.home.score}`);
      summaries.push(line);
    } else {
      pushObserved(evidence, "Score not on this feed. ESPN did not publish both team scores.", "score");
      missingNotes.push("Score not on this feed");
    }
  } else if (wants(parsed.intents, "score") && !game) {
    missingNotes.push("Score not on this feed");
  }

  if (wants(parsed.intents, "winner") && game) {
    const line = scoreLine(game);
    const winner = publishedWinner(game);
    if (game.status.state === "post" && winner && line) {
      pushObserved(evidence, `ESPN final: ${winner.shortName} won · ${line}`, "winner");
      headlines.push(`${winner.shortName} wins`);
      summaries.push(`${winner.shortName} won · ${line}`);
    } else if (game.status.state !== "post") {
      pushObserved(evidence, "Game is not final on this ESPN feed.", "winner");
      missingNotes.push("not final");
    } else {
      pushObserved(evidence, "Winner not published on this feed.", "winner");
      missingNotes.push("Winner not on this feed");
    }
  } else if (wants(parsed.intents, "winner") && !game) {
    missingNotes.push("Winner not on this feed");
  }

  if (wants(parsed.intents, "record")) {
    const fromTeam = team?.record;
    const fromGame = game ? `${game.away.shortName} ${game.away.record ?? "—" } · ${game.home.shortName} ${game.home.record ?? "—"}` : null;
    if (fromTeam) {
      pushObserved(evidence, `${team.shortName} ESPN record ${fromTeam}`, "record");
      headlines.push(`${team.shortName} ${fromTeam}`);
      summaries.push(`${team.shortName} is ${fromTeam} on this ESPN team feed.`);
    } else if (game && (game.home.record || game.away.record)) {
      pushObserved(evidence, `ESPN records: ${fromGame}`, "record");
      summaries.push(`Published records: ${fromGame}.`);
    } else if (wants(parsed.intents, "record") && !parsed.intents.includes("general")) {
      pushObserved(evidence, "Record not published on this feed.", "record");
      missingNotes.push("Record not on this feed");
    }
  }

  if (wants(parsed.intents, "rank")) {
    const pollHits = rankings ? matchRankRows(question, rankings) : [];
    const teamRank = team?.rank;
    const askedSpecific = Boolean(question && (pollHits.length > 0 || mentionsTeam(question, team ?? { name: "", shortName: "", abbreviation: "" })));
    if (pollHits.length > 0) {
      const row = pollHits[0]!;
      const points = row.points != null ? ` · ${row.points} points` : "";
      pushObserved(
        evidence,
        `${rankings?.shortName ?? "Poll"}: ${row.team.name} #${row.rank}${row.record ? ` (${row.record})` : ""}${points}`,
        "rank"
      );
      headlines.push(`${row.team.abbreviation} #${row.rank}`);
      summaries.push(`${row.team.name} is ranked ${row.rank} on the published ${rankings?.name ?? "ESPN poll"}.`);
    } else if (teamRank != null) {
      pushObserved(evidence, `${team!.shortName} ESPN rank #${teamRank}`, "rank");
      headlines.push(`${team!.shortName} #${teamRank}`);
      summaries.push(`${team!.shortName} is ranked ${teamRank} on this ESPN team feed.`);
    } else if (game && (game.home.rank != null || game.away.rank != null) && !askedSpecific) {
      pushObserved(
        evidence,
        `ESPN curated ranks: ${game.away.shortName} ${game.away.rank != null ? `#${game.away.rank}` : "unranked"} · ${game.home.shortName} ${game.home.rank != null ? `#${game.home.rank}` : "unranked"}`,
        "rank"
      );
    } else if (rankings || team || parsed.intents.includes("rank")) {
      pushObserved(evidence, "Rank not on this feed.", "rank");
      missingNotes.push("Rank not on this feed");
    }
  }

  if (wants(parsed.intents, "leaders")) {
    const usable = leaders.filter((row) => row.name && row.displayValue);
    if (usable.length > 0) {
      for (const row of usable) {
        pushObserved(evidence, `ESPN ${row.category}: ${row.name} ${row.displayValue}`, "leaders");
      }
      summaries.push(
        `Published leaders: ${usable.map((row) => `${row.name} ${row.displayValue}`).join("; ")}.`
      );
    } else {
      pushObserved(evidence, "Leaders not on this feed.", "leaders");
      missingNotes.push("Leaders not on this feed");
    }
  }

  if (wants(parsed.intents, "situation")) {
    const sit = game?.situation;
    if (sit?.downDistanceText) {
      const extra = [
        sit.possessionText ? `spot ${sit.possessionText}` : null,
        sit.lastPlay ? `last play ${sit.lastPlay}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      pushObserved(evidence, `ESPN situation: ${sit.downDistanceText}${extra ? ` · ${extra}` : ""}`, "situation");
      summaries.push(`Live situation on this feed: ${sit.downDistanceText}.`);
    } else {
      pushObserved(evidence, "Situation not on this feed.", "situation");
      missingNotes.push("Situation not on this feed");
    }
  }

  if (wants(parsed.intents, "schedule")) {
    const name = team?.shortName ?? "Team";
    if (upcoming[0]) {
      const line = formatScheduleGame(upcoming[0], name);
      pushObserved(evidence, `Next on this ESPN schedule: ${line}`, "schedule");
      headlines.push(`Next: ${upcoming[0].opponent.name}`);
      summaries.push(line);
    }
    if (recent[0] && recent[0].teamScore != null && recent[0].opponentScore != null) {
      pushObserved(evidence, `Recent: ${formatScheduleGame(recent[0], name)}`, "schedule");
    }
    if (!upcoming[0] && !recent[0]) {
      pushObserved(evidence, "Schedule not published on this feed.", "schedule");
      missingNotes.push("Schedule not on this feed");
    }
  }

  if (wants(parsed.intents, "stats")) {
    const askedPercentile = /\bpercentile\b/i.test(question);
    const askedSample = /\bsample size\b/i.test(question);
    if (askedPercentile || askedSample) {
      missingNotes.push("cannot verify");
    }
    const pack: Array<{ label: string; stats: TeamSeasonStats | null }> = [
      { label: team?.shortName ?? "Team", stats: input.data.teamStats },
      { label: game?.away.shortName ?? "Away", stats: input.data.awayStats },
      { label: game?.home.shortName ?? "Home", stats: input.data.homeStats },
    ];
    let quoted = false;
    for (const row of pack) {
      if (!row.stats?.available) continue;
      if (row.stats.pointsPerGame != null) {
        pushObserved(evidence, `${row.label} ESPN PPG ${row.stats.pointsPerGame}`, "stats");
        summaries.push(`${row.label} points per game ${row.stats.pointsPerGame} on this feed.`);
        quoted = true;
      }
      if (row.stats.gamesPlayed != null) {
        pushObserved(evidence, `${row.label} ESPN games played ${row.stats.gamesPlayed}`, "stats");
      }
    }
    if (!quoted && !askedPercentile && !askedSample) {
      pushObserved(evidence, "Season stats not on this feed.", "stats");
      missingNotes.push("Stats not on this feed");
    } else if (!quoted) {
      pushObserved(
        evidence,
        "That split and n-count are not on this feed and are never invented.",
        "stats"
      );
    }
  }

  if (wants(parsed.intents, "comparison") && game) {
    if (game.home.rank != null || game.away.rank != null) {
      pushObserved(
        evidence,
        `ESPN curated ranks: ${game.away.shortName} ${game.away.rank != null ? `#${game.away.rank}` : "unranked"} · ${game.home.shortName} ${game.home.rank != null ? `#${game.home.rank}` : "unranked"}`,
        "rank"
      );
    }
    if (game.home.record || game.away.record) {
      pushObserved(
        evidence,
        `ESPN records: ${game.away.shortName} ${game.away.record ?? "not published"} · ${game.home.shortName} ${game.home.record ?? "not published"}`,
        "record"
      );
    }
    if (input.data.awayStats?.pointsPerGame != null) {
      pushObserved(evidence, `${game.away.shortName} ESPN PPG ${input.data.awayStats.pointsPerGame}`, "stats");
    }
    if (input.data.homeStats?.pointsPerGame != null) {
      pushObserved(evidence, `${game.home.shortName} ESPN PPG ${input.data.homeStats.pointsPerGame}`, "stats");
    }
    const rankedSides = [game.away, game.home].filter((side) => side.rank != null);
    rankedSides.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    const ahead = rankedSides[0];
    if (ahead) {
      inference.push({
        kind: "model",
        badge: "INFERENCE",
        text: `On published ESPN rank, ${ahead.shortName} sits ahead. This is model narrative, not a live score or lock.`,
      });
      inference.push({
        kind: "model",
        badge: "SIMULATION",
        text: `SIMULATION narrative: published rank/record favor ${ahead.shortName} on paper. Harmon Line is not naming a lock.`,
      });
      headlines.push(`${ahead.shortName} ahead on published rank`);
      summaries.push(
        `Published rank puts ${ahead.shortName} ahead of ${ahead.id === game.home.id ? game.away.shortName : game.home.shortName}.`
      );
    } else {
      inference.push({
        kind: "model",
        badge: "INFERENCE",
        text: "Not enough published rank/record on this feed to compare the sides. Harmon Line will not invent a matchup lean.",
      });
      missingNotes.push("not on this feed");
    }
  }

  const positive = evidence.filter((row) => isPositiveEvidence(row.text));
  const empty = positive.length === 0;

  if (!question) {
    missingNotes.push("Ask a situational sports question grounded on ESPN public feeds.");
  }

  if (empty && evidence.length === 0) {
    pushObserved(
      evidence,
      "No matching game or team on this feed for this question.",
      "empty"
    );
  }

  const honestyDetail = empty
    ? missingNotes[0]
      ? `${missingNotes[0]}. The Harmon Line Stat Oracle answers only from public ESPN summary/scoreboard/rankings (and optional CFBD). Unpublished numbers are never invented.`
      : "The Harmon Line Stat Oracle could not verify that from the public ESPN summary/scoreboard/rankings on this request. Unpublished numbers are never invented."
    : missingNotes.length > 0
      ? `Answered from published ESPN cells. ${missingNotes.join("; ")} — cannot verify the rest. Unpublished numbers are never invented.`
      : "Answered from published ESPN summary/scoreboard/rankings cells. Blank fields are omissions, not zeros we invented.";

  const headline =
    headlines[0] ??
    (empty ? "NOT ON THIS FEED" : parsed.bettingAdjacent ? "NO ODDS ON THIS ORACLE" : "ESPN PUBLIC FEED");
  const summary =
    summaries.join(" ") ||
    (empty
      ? missingNotes.length > 0
        ? `Not on this feed: ${missingNotes.join("; ")}.`
        : "The Harmon Line Stat Oracle could not verify that from the public ESPN summary/scoreboard/rankings on this request."
      : "Published ESPN facts are listed under Evidence.");

  const source: OracleResponse["source"] =
    input.data.cfbdConfigured && input.data.cfbdFilled.length > 0 ? "espn+cfbd" : "espn";

  return {
    source,
    demo: false,
    generatedAt: (input.now ?? new Date()).toISOString(),
    modelVersion: ORACLE_MODEL_VERSION,
    question,
    league: input.league,
    empty,
    grounded: {
      gameId: game?.id ?? null,
      teamId: team?.id ?? game?.home.id ?? null,
      endpoints: input.data.endpoints,
    },
    honesty: {
      headline: empty ? "NOT ON THIS FEED" : "ESPN PUBLIC FEED",
      detail: honestyDetail,
    },
    answer: { headline, summary },
    evidence,
    inference,
    coverage: {
      headline: empty ? "NOT ON THIS FEED" : "GROUNDED ON ESPN",
      detail: honestyDetail,
    },
    disclaimer: parsed.bettingAdjacent ? `${BETTING_DISCLAIMER} 1-800-GAMBLER.` : null,
    disclaimerLong: parsed.bettingAdjacent ? BETTING_DISCLAIMER_LONG : null,
  };
}

export async function askOracle(input: {
  question: string;
  league?: string | null;
  gameId?: string | null;
  teamId?: string | null;
  now?: Date;
}): Promise<OracleResponse> {
  const parsed = parseOracleRequest(input);
  const league = parsed.league;
  const spec = getLeague(league);
  const intents = parseOracleQuestion(parsed.question).intents;
  const data = emptyOracleData();
  data.cfbdConfigured = league === "cfb" && cfbdKeyConfigured();
  const now = input.now ?? new Date();

  if (!parsed.question) {
    return answerOracle({ question: "", league, data, now });
  }

  if (parsed.gameId) {
    try {
      const detail = await getGameDetail(parsed.gameId, league);
      data.game = detail.game;
      data.leaders = detail.leaders;
      data.endpoints.push(`/summary?event=${parsed.gameId}`);
    } catch {
      data.endpoints.push(`/summary?event=${parsed.gameId}`);
    }
  }

  if (parsed.teamId) {
    try {
      const page = await getTeamPage(parsed.teamId, league);
      data.team = page.team;
      data.recent = page.recent;
      data.upcoming = page.upcoming;
      data.endpoints.push(`/teams/${parsed.teamId}`);
    } catch {
      data.endpoints.push(`/teams/${parsed.teamId}`);
    }
  }

  if (!data.game) {
    try {
      const board = await getScoreboard({
        league,
        division: "d1",
        date: todayEspnDate(now),
        view: spec.navMode === "week" ? "week" : "date",
      });
      data.endpoints.push("/scoreboard");
      const hits = matchGamesForQuestion(parsed.question, board.games);
      if (hits[0]) {
        data.game = hits[0];
        if (
          (intents.includes("leaders") || intents.includes("situation")) &&
          data.game.id
        ) {
          try {
            const detail = await getGameDetail(data.game.id, league);
            data.game = detail.game;
            data.leaders = detail.leaders;
            data.endpoints.push(`/summary?event=${data.game.id}`);
          } catch {
            /* board snapshot still used */
          }
        }
      }
    } catch {
      data.endpoints.push("/scoreboard");
    }
  }

  if (
    (intents.includes("rank") || intents.includes("comparison") || intents.includes("general")) &&
    spec.rankings
  ) {
    try {
      const rankings = await getRankings("ap", league);
      data.rankings = rankings.selected;
      data.endpoints.push("/rankings");
    } catch {
      data.endpoints.push("/rankings");
    }
  }

  const statsTeamIds = new Set<string>();
  if (data.team?.id) statsTeamIds.add(data.team.id);
  if (data.game?.home.id) statsTeamIds.add(data.game.home.id);
  if (data.game?.away.id) statsTeamIds.add(data.game.away.id);

  if (
    (intents.includes("stats") || intents.includes("comparison")) &&
    statsTeamIds.size > 0
  ) {
    const ids = [...statsTeamIds];
    const payloads = await Promise.all(ids.map((id) => settledEspn(`/teams/${id}/statistics`, league)));
    ids.forEach((id, index) => {
      data.endpoints.push(`/teams/${id}/statistics`);
      const parsedStats = parseTeamSeasonStats(payloads[index]);
      if (data.team?.id === id) data.teamStats = parsedStats;
      if (data.game?.home.id === id) data.homeStats = parsedStats;
      if (data.game?.away.id === id) data.awayStats = parsedStats;
    });
  }

  if (league === "cfb" && data.cfbdConfigured) {
    const key = process.env.CFBD_API_KEY?.trim() ?? "";
    const year = new Date(data.game?.date || Date.now()).getUTCFullYear();
    const targets: Array<{ name: string; short: string; slot: "home" | "away" | "team" }> = [];
    if (data.game) {
      targets.push({
        name: data.game.home.name,
        short: data.game.home.shortName,
        slot: "home",
      });
      targets.push({
        name: data.game.away.name,
        short: data.game.away.shortName,
        slot: "away",
      });
    } else if (data.team) {
      targets.push({ name: data.team.name, short: data.team.shortName, slot: "team" });
    }
    if (key && targets.length > 0) {
      const filled: string[] = [];
      await Promise.all(
        targets.map(async (target) => {
          const cfbd = await fetchCfbdSeasonStats(cfbdTeamQueryName(target.name, target.short), year, key);
          if (target.slot === "home") {
            const base = data.homeStats ?? parseTeamSeasonStats({});
            const merged = mergeCfbdStats(base, cfbd);
            data.homeStats = merged.stats;
            filled.push(...merged.filled.map((field) => `${target.short} ${field}`));
          } else if (target.slot === "away") {
            const base = data.awayStats ?? parseTeamSeasonStats({});
            const merged = mergeCfbdStats(base, cfbd);
            data.awayStats = merged.stats;
            filled.push(...merged.filled.map((field) => `${target.short} ${field}`));
          } else {
            const base = data.teamStats ?? parseTeamSeasonStats({});
            const merged = mergeCfbdStats(base, cfbd);
            data.teamStats = merged.stats;
            filled.push(...merged.filled.map((field) => `${target.short} ${field}`));
          }
        })
      );
      data.cfbdFilled = filled;
    }
  }

  return answerOracle({
    question: parsed.question,
    league,
    data,
    now,
  });
}

export { sportOracleHref };
