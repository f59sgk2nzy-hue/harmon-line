import {
  CONFERENCE_NAMES,
  coverageFor,
  DIVISION_GROUPS,
  conferenceLabel,
} from "@/lib/conferences";
import { espnGet } from "@/lib/espn-http";
import { teamLogoUrl } from "@/lib/espn-path";
import { parseGamecastDepth } from "@/lib/espn-gamecast";
import {
  classifySubdivision,
  collectClassificationIds,
  divisionFromClassification,
  parseLinescores,
} from "@/lib/espn-parse";
import {
  espnScoreboardPath,
  parseRegularSeasonWeeks,
  parseSeasonYear,
  weekForEspnDate,
} from "@/lib/espn-weeks";
import { DEFAULT_LEAGUE, assertLeagueShipped, getLeague } from "@/lib/leagues";
import type {
  ConferenceOption,
  CoverageNote,
  DivisionId,
  Drive,
  GameDetailResponse,
  GameState,
  GameSummary,
  GameSituation,
  LeaderLine,
  LeagueId,
  PlayByPlayPlay,
  ScoreboardResponse,
  ScoreboardView,
  ScoreboardWeek,
  ScoringPlay,
  SubdivisionId,
  TeamSide,
} from "@/lib/types";

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
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

function parseState(value: unknown): GameState {
  const state = str(value);
  if (state === "in" || state === "pre" || state === "post") return state;
  return "pre";
}

function parseTeam(
  raw: unknown,
  fallbackHomeAway: "home" | "away",
  league: LeagueId = DEFAULT_LEAGUE
): TeamSide | null {
  const competitor = asRecord(raw);
  if (!competitor) return null;
  const team = asRecord(competitor.team) ?? {};
  const id = str(team.id || competitor.id);
  if (!id) return null;
  const records = asArray(competitor.records);
  const overall =
    records
      .map(asRecord)
      .find((row) => row && (row.type === "total" || row.abbreviation === "overall")) ??
    asRecord(records[0]);
  const rank = asRecord(competitor.curatedRank);
  const rankValue = num(rank?.current);
  const homeAway =
    competitor.homeAway === "home" || competitor.homeAway === "away"
      ? competitor.homeAway
      : fallbackHomeAway;
  const conferenceId = str(team.conferenceId) || null;

  return {
    id,
    name: str(team.displayName || team.name, "Unknown"),
    shortName: str(team.shortDisplayName || team.abbreviation || team.name, "UNK"),
    abbreviation: str(team.abbreviation, "UNK").toUpperCase(),
    score: num(competitor.score),
    record: overall ? str(overall.summary) || null : null,
    rank: rankValue && rankValue > 0 && rankValue <= 25 ? rankValue : null,
    color: hexColor(team.color),
    altColor: hexColor(team.alternateColor),
    logo: teamLogoUrl(id, league),
    conferenceId,
    conferenceName: conferenceLabel(conferenceId),
    winner: Boolean(competitor.winner),
    linescores: parseLinescores(competitor.linescores),
    homeAway,
  };
}

function parseSituation(raw: unknown): GameSituation | null {
  const situation = asRecord(raw);
  if (!situation) return null;
  const lastPlay = asRecord(situation.lastPlay);
  return {
    down: num(situation.down),
    distance: num(situation.distance),
    downDistanceText: str(situation.downDistanceText) || null,
    possessionText: str(situation.possessionText) || null,
    possessionTeamId: str(situation.possession) || null,
    isRedZone: Boolean(situation.isRedZone),
    lastPlay: str(lastPlay?.text) || null,
    homeTimeouts: num(situation.homeTimeouts),
    awayTimeouts: num(situation.awayTimeouts),
  };
}

function parseEvent(
  raw: unknown,
  division: DivisionId,
  groupIds: string | string[] = [],
  league: LeagueId = DEFAULT_LEAGUE
): GameSummary | null {
  const event = asRecord(raw);
  if (!event) return null;
  const competition = asRecord(asArray(event.competitions)[0]) ?? event;
  const status = asRecord(event.status) ?? asRecord(competition.status) ?? {};
  const statusType = asRecord(status.type) ?? {};
  const competitors = asArray(competition.competitors);
  const homeRaw =
    competitors.map(asRecord).find((row) => row?.homeAway === "home") ?? competitors[0];
  const awayRaw =
    competitors.map(asRecord).find((row) => row?.homeAway === "away") ?? competitors[1];
  const home = parseTeam(homeRaw, "home", league);
  const away = parseTeam(awayRaw, "away", league);
  if (!home || !away) return null;

  const venue = asRecord(competition.venue);
  const address = asRecord(venue?.address);
  const broadcasts = asArray(competition.broadcasts);
  const firstBroadcast = asRecord(broadcasts[0]);
  const names = asArray(firstBroadcast?.names).map((n) => str(n)).filter(Boolean);
  const week = asRecord(event.week);

  const conferenceIds = [away.conferenceId, home.conferenceId].filter(
    (id): id is string => Boolean(id)
  );

  return {
    id: str(event.id || competition.id),
    name: str(event.name, `${away.name} at ${home.name}`),
    shortName: str(event.shortName, `${away.abbreviation} @ ${home.abbreviation}`),
    date: str(event.date || competition.date),
    week: num(week?.number),
    status: {
      state: parseState(statusType.state),
      detail: str(statusType.detail || statusType.description, "Scheduled"),
      shortDetail: str(statusType.shortDetail || statusType.detail, "Scheduled"),
      period: num(status.period),
      clock: str(status.displayClock) || null,
      completed: Boolean(statusType.completed),
    },
    home,
    away,
    venue: str(venue?.fullName) || null,
    venueCity: [str(address?.city), str(address?.state)].filter(Boolean).join(", ") || null,
    broadcast: names[0] ?? (str(competition.broadcast) || null),
    situation: getLeague(league).detailModules.footballSituation
      ? parseSituation(competition.situation)
      : null,
    playByPlayAvailable: Boolean(competition.playByPlayAvailable),
    subdivision: resolveSubdivision(
      [event, competition, homeRaw, awayRaw],
      groupIds,
      [home.conferenceId, away.conferenceId],
      division
    ),
    conferenceIds,
  };
}

function resolveSubdivision(
  nodes: unknown[],
  groupIds: string | string[],
  conferenceIds: Array<string | null>,
  division: DivisionId
): GameSummary["subdivision"] {
  const extra = Array.isArray(groupIds) ? groupIds : [groupIds];
  return (
    classifySubdivision(
      [...collectClassificationIds(...nodes), ...extra, ...conferenceIds],
      division
    ) ??
    (division === "naia" ? "NAIA" : division === "d2" ? "D2" : null) ??
    "FBS"
  );
}

function sortGames(games: GameSummary[]): GameSummary[] {
  const rank = (state: GameState) => (state === "in" ? 0 : state === "pre" ? 1 : 2);
  return [...games].sort((a, b) => {
    const stateDelta = rank(a.status.state) - rank(b.status.state);
    if (stateDelta !== 0) return stateDelta;
    return a.date.localeCompare(b.date) || a.shortName.localeCompare(b.shortName);
  });
}

function collectConferences(games: GameSummary[]): ConferenceOption[] {
  const map = new Map<string, ConferenceOption>();
  for (const game of games) {
    for (const team of [game.away, game.home]) {
      if (!team.conferenceId) continue;
      const known = CONFERENCE_NAMES[team.conferenceId];
      map.set(
        team.conferenceId,
        known ?? {
          id: team.conferenceId,
          name: team.conferenceName ?? `Conference ${team.conferenceId}`,
        }
      );
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getScoreboard(options: {
  division: DivisionId;
  date: string;
  subdivision?: SubdivisionId;
  week?: number | null;
  year?: number | null;
  view?: ScoreboardView;
  league?: LeagueId | string | null;
}): Promise<ScoreboardResponse> {
  const league = assertLeagueShipped(options.league);
  const { division, date } = options;
  const view: ScoreboardView = options.view ?? (options.week ? "week" : "date");
  const groups =
    division === "d1" && options.subdivision && options.subdivision !== "all"
      ? [options.subdivision === "fbs" ? "80" : "81"]
      : DIVISION_GROUPS[division].groups;

  const payloads = await Promise.all(
    groups.map(async (group) => ({
      group,
      data: await espnGet(
        espnScoreboardPath({
          group,
          date,
          week: options.week,
          year: options.year,
          view,
        }),
        league.id
      ),
    }))
  );

  const byId = new Map<string, GameSummary>();
  let payloadWeek: number | null = null;
  let seasonYear: number | null = options.year ?? null;
  let seasonType: number | null = null;
  let calendarSource: Json | null = null;

  for (const { group, data } of payloads) {
    if (!calendarSource) calendarSource = data;
    const payloadSeason = asRecord(data.season);
    seasonYear = num(payloadSeason?.year) ?? seasonYear;
    seasonType = num(payloadSeason?.type) ?? seasonType;
    const weekNumber = num(asRecord(data.week)?.number);
    if (weekNumber) payloadWeek = weekNumber;
    for (const event of asArray(data.events)) {
      const game = parseEvent(event, division, group, league.id);
      if (!game) continue;
      const existing = byId.get(game.id);
      if (!existing) {
        byId.set(game.id, game);
        continue;
      }
      if (existing.subdivision === "FBS" && game.subdivision === "FCS") {
        continue;
      }
    }
  }

  const parsedWeeks = parseRegularSeasonWeeks(calendarSource);
  const weeks: ScoreboardWeek[] = parsedWeeks.map((entry) => ({
    number: entry.number,
    label: entry.label,
    detail: entry.detail,
    startEspnDate: entry.startEspnDate,
  }));
  const mapped = weekForEspnDate(date, parsedWeeks);
  const week =
    view === "week" && options.week
      ? options.week
      : (mapped?.number ?? (seasonType === 2 ? payloadWeek : null));
  seasonYear = seasonYear ?? parseSeasonYear(null, date);

  const games = sortGames([...byId.values()]);
  return {
    source: "espn",
    demo: false,
    league: league.id,
    date,
    division,
    week,
    seasonYear,
    seasonType,
    weeks,
    view,
    generatedAt: new Date().toISOString(),
    games,
    conferences: collectConferences(games),
    liveCount: games.filter((game) => game.status.state === "in").length,
    coverage: coverageFor(division),
  };
}

function parsePlay(raw: unknown): PlayByPlayPlay | null {
  const play = asRecord(raw);
  if (!play) return null;
  const period = asRecord(play.period);
  const clock = asRecord(play.clock);
  const type = asRecord(play.type);
  const participants = asArray(play.teamParticipants).map(asRecord);
  const offense = participants.find((row) => row?.type === "offense");
  const team = asRecord(play.team) ?? asRecord(offense?.team);
  return {
    id: str(play.id || play.sequenceNumber, crypto.randomUUID()),
    text: str(play.text),
    period: num(period?.number),
    clock: str(clock?.displayValue) || null,
    homeScore: num(play.homeScore),
    awayScore: num(play.awayScore),
    scoringPlay: Boolean(play.scoringPlay),
    type: str(type?.text) || null,
    teamId: str(team?.id) || str(offense?.id) || null,
  };
}

function parseDrive(raw: unknown): Drive | null {
  const drive = asRecord(raw);
  if (!drive) return null;
  const team = asRecord(drive.team);
  const plays = asArray(drive.plays)
    .map(parsePlay)
    .filter((play): play is PlayByPlayPlay => Boolean(play && play.text));
  return {
    id: str(drive.id, crypto.randomUUID()),
    description: str(drive.description) || null,
    result: str(drive.displayResult || drive.result) || null,
    teamId: str(team?.id) || null,
    teamName: str(team?.displayName || team?.shortDisplayName) || null,
    yards: num(drive.yards),
    plays,
  };
}

function parseScoringPlay(raw: unknown): ScoringPlay | null {
  const play = asRecord(raw);
  if (!play) return null;
  const period = asRecord(play.period);
  const clock = asRecord(play.clock);
  const type = asRecord(play.type);
  const team = asRecord(play.team);
  return {
    id: str(play.id, crypto.randomUUID()),
    text: str(play.text),
    period: num(period?.number),
    clock: str(clock?.displayValue) || null,
    homeScore: num(play.homeScore) ?? 0,
    awayScore: num(play.awayScore) ?? 0,
    teamId: str(team?.id) || null,
    teamName: str(team?.displayName) || null,
    type: str(type?.text) || null,
  };
}

function parseLeaders(raw: unknown): LeaderLine[] {
  const lines: LeaderLine[] = [];
  for (const category of asArray(raw)) {
    const cat = asRecord(category);
    if (!cat) continue;
    const label = str(cat.displayName || cat.name, "Leader");
    const leaders = asArray(cat.leaders);
    const first = asRecord(leaders[0]);
    if (!first) continue;
    const athlete = asRecord(first.athlete) ?? asRecord(asArray(first.athletes)[0]);
    const team = asRecord(first.team);
    const name = str(athlete?.displayName || athlete?.fullName || first.displayValue);
    if (!name) continue;
    lines.push({
      category: label,
      name,
      displayValue: str(first.displayValue),
      teamId: str(team?.id) || null,
    });
  }
  return lines;
}

function gameFromHeader(
  header: Json,
  fallbackId: string,
  extra?: Json | null,
  league: LeagueId = DEFAULT_LEAGUE
): GameSummary | null {
  const competitions = asArray(header.competitions);
  const wrapped = {
    ...header,
    id: str(header.id, fallbackId),
    competitions,
  };
  const ids = collectClassificationIds(wrapped, extra, header);
  const classified = classifySubdivision(ids);
  const division: DivisionId = classified
    ? divisionFromClassification(classified)
    : "d1";
  return parseEvent(wrapped, division, ids, league);
}

function pbpCoverage(game: GameSummary, hasDrives: boolean): CoverageNote {
  if (hasDrives || game.playByPlayAvailable) {
    return {
      headline: "Play-by-play from ESPN summary",
      detail: "Live drive chart and plays are polling the public ESPN summary endpoint.",
    };
  }
  if (game.subdivision === "NAIA") {
    return {
      headline: "No play-by-play on this feed",
      detail:
        "ESPN almost never publishes NAIA play-by-play. Scores and kickoff times are shown when the public scoreboard includes the game.",
    };
  }
  if (game.subdivision === "D2" || game.subdivision === "D3") {
    return {
      headline: "Play-by-play not published",
      detail:
        game.subdivision === "D3"
          ? "ESPN flagged this Division III game as scores-only. The scoreboard still updates; there is no drive feed to invent."
          : "ESPN flagged this Division II game as scores-only. The scoreboard still updates; there is no drive feed to invent.",
    };
  }
  return {
    headline: "Play-by-play not published",
    detail:
      "ESPN has not released a play-by-play feed for this game. Scoring updates still come from the live scoreboard.",
  };
}

export async function getGameDetail(
  eventId: string,
  leagueParam?: LeagueId | string | null
): Promise<GameDetailResponse> {
  if (!/^\d+$/.test(eventId)) {
    throw new Error("Invalid game id");
  }

  const league = assertLeagueShipped(leagueParam);
  const data = await espnGet(`/summary?event=${eventId}`, league.id);
  const header = asRecord(data.header) ?? {};
  let game = gameFromHeader(header, eventId, asRecord(data.meta), league.id);

  if (!game) {
    const scoreboard = await espnGet(`/scoreboard?limit=300`, league.id);
    const match = asArray(scoreboard.events)
      .map((event) =>
        parseEvent(event, "d1", collectClassificationIds(asRecord(event) ?? {}), league.id)
      )
      .find((row) => row?.id === eventId);
    if (!match) {
      throw new Error("Game not found on ESPN");
    }
    game = match;
  }

  const drives =
    league.detailModules.primary === "drives"
      ? (() => {
          const drivesNode = asRecord(data.drives);
          const previous = asArray(drivesNode?.previous).map(parseDrive);
          const current = parseDrive(drivesNode?.current);
          return [...previous, current].filter((row): row is Drive => Boolean(row));
        })()
      : [];
  const scoringPlays = asArray(data.scoringPlays)
    .map(parseScoringPlay)
    .filter((row): row is ScoringPlay => Boolean(row));

  const playByPlayAvailable = drives.some((drive) => drive.plays.length > 0);
  const gameInfo = asRecord(data.gameInfo);
  const infoVenue = asRecord(gameInfo?.venue);
  const infoAddress = asRecord(infoVenue?.address);
  const broadcasts = asArray(data.broadcasts)
    .map((row) => {
      const item = asRecord(row);
      return str(item?.shortName || item?.name || asArray(item?.names)[0]);
    })
    .filter(Boolean);

  const hydrated: GameSummary = {
    ...game,
    playByPlayAvailable: playByPlayAvailable || game.playByPlayAvailable,
    venue: game.venue || str(infoVenue?.fullName) || null,
    venueCity:
      game.venueCity ||
      [str(infoAddress?.city), str(infoAddress?.state)].filter(Boolean).join(", ") ||
      null,
    broadcast: game.broadcast || broadcasts[0] || null,
  };

  const depth = parseGamecastDepth(data);

  return {
    source: "espn",
    demo: false,
    league: league.id,
    generatedAt: new Date().toISOString(),
    game: hydrated,
    scoringPlays,
    drives,
    leaders: parseLeaders(data.leaders),
    playByPlayAvailable,
    coverage: pbpCoverage(game, playByPlayAvailable),
    teamStats: depth.teamStats,
    playerBox: depth.playerBox,
    standings: depth.standings,
    news: depth.news,
  };
}

export function parseDivision(value: string | null | undefined): DivisionId {
  if (value === "d2" || value === "naia" || value === "d1") return value;
  return "d1";
}

export function parseSubdivision(value: string | null | undefined): SubdivisionId {
  if (value === "fbs" || value === "fcs" || value === "all") return value;
  return "all";
}
