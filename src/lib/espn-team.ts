import { conferenceLabel, nflConferenceForTeam } from "@/lib/conferences";
import { espnGet } from "@/lib/espn-http";
import { classifySubdivision, collectClassificationIds } from "@/lib/espn-parse";
import { teamLogoUrl } from "@/lib/espn-path";
import { DEFAULT_LEAGUE, assertLeagueShipped } from "@/lib/leagues";
import type {
  Classification,
  CoverageNote,
  GameState,
  LeagueId,
  TeamPageResponse,
  TeamProfile,
  TeamRosterPlayer,
  TeamScheduleGame,
} from "@/lib/types";

const RECENT_LIMIT = 8;
const UPCOMING_LIMIT = 10;

type Json = Record<string, unknown>;

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

function parseState(value: unknown): GameState {
  const state = str(value);
  if (state === "in" || state === "pre" || state === "post") return state;
  return "pre";
}

function competitorScore(raw: Json | null): number | null {
  if (!raw) return null;
  const score = raw.score;
  if (score && typeof score === "object") {
    const rec = asRecord(score);
    return rec ? (num(rec.value) ?? num(rec.displayValue)) : null;
  }
  return num(score);
}

export function parseTeamProfile(
  payload: unknown,
  league: LeagueId = DEFAULT_LEAGUE
): TeamProfile {
  const root = asRecord(payload) ?? {};
  const team = asRecord(root.team) ?? root;
  const id = str(team.id);
  if (!id) throw new Error("Team not found on ESPN");
  const records = asRecord(team.record);
  const items = asArray(records?.items).map(asRecord);
  const overall =
    items.find((row) => row && (row.type === "total" || row.abbreviation === "overall")) ??
    items[0];
  const rank = asRecord(team.rank);
  const rankValue = num(rank?.current);
  const groups = asRecord(team.groups);
  const conferenceFromTeam = str(team.conferenceId) || str(groups?.id) || null;
  const nflConference = league === "nfl" ? nflConferenceForTeam(id) : null;
  const conferenceId = nflConference?.id ?? conferenceFromTeam;
  const ids = collectClassificationIds(team, groups);
  const subdivision =
    league === "nfl"
      ? nflConference?.abbreviation === "AFC"
        ? "AFC"
        : nflConference?.abbreviation === "NFC"
          ? "NFC"
          : "NFL"
      : league === "nba"
        ? "NBA"
        : league === "mbb"
          ? "D1"
          : classifySubdivision(ids);

  return {
    id,
    name: str(team.displayName || team.name, "Unknown"),
    shortName: str(team.shortDisplayName || team.abbreviation || team.name, "UNK"),
    abbreviation: str(team.abbreviation, "UNK").toUpperCase(),
    color: hexColor(team.color),
    altColor: hexColor(team.alternateColor),
    logo: teamLogoUrl(id, league, str(team.abbreviation) || null),
    record: overall ? str(overall.summary) || null : str(team.recordSummary) || null,
    standing: str(team.standingSummary) || null,
    conferenceId,
    conferenceName: nflConference?.name ?? conferenceLabel(conferenceId, league),
    rank: rankValue && rankValue > 0 && rankValue <= 25 ? rankValue : null,
    subdivision,
  };
}

export function parseScheduleEvents(
  raw: unknown,
  teamId: string,
  league: LeagueId = DEFAULT_LEAGUE
): TeamScheduleGame[] {
  const games: TeamScheduleGame[] = [];
  for (const event of asArray(raw)) {
    const row = asRecord(event);
    if (!row) continue;
    const competition = asRecord(asArray(row.competitions)[0]) ?? {};
    const status = asRecord(competition.status) ?? asRecord(row.status) ?? {};
    const statusType = asRecord(status.type) ?? {};
    const competitors = asArray(competition.competitors).map(asRecord);
    const self =
      competitors.find((c) => str(asRecord(c?.team)?.id) === teamId) ??
      competitors.find((c) => str(c?.id) === teamId);
    const opp = competitors.find((c) => c && c !== self);
    if (!self || !opp) continue;
    const selfTeam = asRecord(self.team) ?? {};
    const oppTeam = asRecord(opp.team) ?? {};
    const oppId = str(oppTeam.id || opp.id);
    const teamScore = competitorScore(self);
    const opponentScore = competitorScore(opp);
    const homeAway = self.homeAway === "away" ? "away" : "home";
    let result: TeamScheduleGame["result"] = null;
    if (statusType.state === "post" && teamScore != null && opponentScore != null) {
      result = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T";
    } else if (self.winner === true) {
      result = "W";
    } else if (self.winner === false && statusType.state === "post") {
      result = "L";
    }
    const broadcasts = asArray(competition.broadcasts);
    const firstBroadcast = asRecord(broadcasts[0]);
    const media = asRecord(firstBroadcast?.media);
    const venue = asRecord(competition.venue);
    const week = asRecord(row.week);

    games.push({
      id: str(row.id || competition.id),
      date: str(row.date || competition.date),
      week: num(week?.number),
      state: parseState(statusType.state),
      shortDetail: str(statusType.shortDetail || statusType.detail, "Scheduled"),
      venue: str(venue?.fullName) || null,
      broadcast: str(media?.shortName || firstBroadcast?.shortName) || null,
      homeAway,
      opponent: {
        id: oppId,
        name: str(oppTeam.displayName || oppTeam.name, "Opponent"),
        abbreviation: str(oppTeam.abbreviation, "OPP").toUpperCase(),
        logo: teamLogoUrl(oppId || "0", league, str(oppTeam.abbreviation) || null),
      },
      teamScore,
      opponentScore,
      result,
    });
  }
  return games;
}

export function splitSchedule(games: TeamScheduleGame[]): {
  recent: TeamScheduleGame[];
  upcoming: TeamScheduleGame[];
} {
  const recent = games
    .filter((game) => game.state === "post" || game.state === "in")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_LIMIT);
  const upcoming = games
    .filter((game) => game.state === "pre")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, UPCOMING_LIMIT);
  return { recent, upcoming };
}

export function parseRosterAthletes(payload: unknown): {
  players: TeamRosterPlayer[];
  coach: string | null;
} {
  const root = asRecord(payload) ?? {};
  const players: TeamRosterPlayer[] = [];
  for (const group of asArray(root.athletes)) {
    const rec = asRecord(group);
    if (!rec) continue;
    const items = asArray(rec.items).length > 0 ? asArray(rec.items) : [rec];
    const groupLabel =
      str(asRecord(rec.position)?.displayName || rec.position) || "Roster";
    for (const item of items) {
      const athlete = asRecord(item);
      if (!athlete?.id && !athlete?.displayName) continue;
      if (asArray(athlete.items).length > 0) continue;
      const position = asRecord(athlete.position);
      const parent = asRecord(position?.parent);
      const experience = asRecord(athlete.experience);
      const name = str(athlete.displayName || athlete.fullName);
      if (!name) continue;
      players.push({
        id: str(athlete.id, name),
        name,
        jersey: str(athlete.jersey) || null,
        position: str(position?.abbreviation || position?.displayName, "—"),
        positionGroup: str(parent?.displayName || groupLabel, "Roster"),
        classYear: str(experience?.abbreviation || experience?.displayValue) || null,
        height: str(athlete.displayHeight) || null,
        weight: str(athlete.displayWeight) || null,
      });
    }
  }

  const coaches = asArray(root.coach).map(asRecord);
  const firstCoach = coaches[0];
  const coach = firstCoach
    ? [str(firstCoach.firstName), str(firstCoach.lastName)].filter(Boolean).join(" ") ||
      str(firstCoach.displayName) ||
      null
    : null;

  players.sort((a, b) => {
    const group = a.positionGroup.localeCompare(b.positionGroup);
    if (group !== 0) return group;
    const ja = Number(a.jersey);
    const jb = Number(b.jersey);
    if (Number.isFinite(ja) && Number.isFinite(jb) && ja !== jb) return ja - jb;
    return a.name.localeCompare(b.name);
  });

  return { players, coach: coach || null };
}

function scheduleCoverage(
  games: TeamScheduleGame[],
  subdivision: Classification | null,
  league: LeagueId = DEFAULT_LEAGUE
): CoverageNote {
  if (games.length > 0) {
    return {
      headline: "Schedule from ESPN public team feed",
      detail:
        league === "mbb"
          ? "Recent results and upcoming games come from ESPN’s unofficial men’s college basketball team schedule."
          : league === "nfl"
            ? "Recent results and upcoming games come from ESPN’s unofficial NFL team schedule."
            : league === "nba"
              ? "Recent results and upcoming games come from ESPN’s unofficial NBA team schedule."
              : "Recent results and upcoming games come from ESPN’s unofficial college-football team schedule.",
    };
  }
  if (subdivision === "NAIA") {
    return {
      headline: "SCHEDULE NOT ON THIS FEED",
      detail:
        "ESPN often omits NAIA-only slates. No games are invented — try another Saturday or a D1/D2 program.",
    };
  }
  if (subdivision === "D2" || subdivision === "D3") {
    return {
      headline: "SCHEDULE NOT PUBLISHED",
      detail: `ESPN has no ${subdivision} schedule for this school on the public team endpoint.`,
    };
  }
  return {
    headline: "SCHEDULE NOT PUBLISHED",
    detail: "ESPN has not released a team schedule for this school.",
  };
}

function rosterCoverage(
  players: TeamRosterPlayer[],
  subdivision: Classification | null
): CoverageNote {
  if (players.length > 0) {
    return {
      headline: "Roster from ESPN public team feed",
      detail: "Jerseys and positions are whatever ESPN published for this season. Headshots are not required.",
    };
  }
  if (subdivision === "NAIA") {
    return {
      headline: "ROSTER NOT ON THIS FEED",
      detail: "ESPN almost never publishes a full NAIA roster. The gap is labeled, not filled with sample players.",
    };
  }
  if (subdivision === "D2" || subdivision === "D3") {
    return {
      headline: "ROSTER NOT ON THIS FEED",
      detail: `ESPN often skips ${subdivision} rosters. No names are invented.`,
    };
  }
  return {
    headline: "ROSTER NOT PUBLISHED",
    detail: "ESPN has not released a roster for this school on the public feed.",
  };
}

export function assembleTeamPage({
  team,
  games,
  players,
  coach,
  league = DEFAULT_LEAGUE,
  now = new Date(),
}: {
  team: TeamProfile;
  games: TeamScheduleGame[];
  players: TeamRosterPlayer[];
  coach: string | null;
  league?: LeagueId;
  now?: Date;
}): TeamPageResponse {
  const { recent, upcoming } = splitSchedule(games);
  return {
    source: "espn",
    demo: false,
    league,
    generatedAt: now.toISOString(),
    team,
    recent,
    upcoming,
    roster: players,
    coach,
    coverage: {
      schedule: scheduleCoverage(games, team.subdivision, league),
      roster: rosterCoverage(players, team.subdivision),
    },
  };
}

export async function getTeamPage(
  teamId: string,
  leagueParam?: LeagueId | string | null
): Promise<TeamPageResponse> {
  if (!/^\d+$/.test(teamId)) {
    throw new Error("Invalid team id");
  }

  const league = assertLeagueShipped(leagueParam);
  const [profileSettled, scheduleSettled, rosterSettled] = await Promise.allSettled([
    espnGet(`/teams/${teamId}`, league.id),
    espnGet(`/teams/${teamId}/schedule`, league.id),
    espnGet(`/teams/${teamId}/roster`, league.id),
  ]);

  if (profileSettled.status === "rejected") {
    throw profileSettled.reason instanceof Error
      ? profileSettled.reason
      : new Error("Team not found on ESPN");
  }

  const team = parseTeamProfile(profileSettled.value, league.id);
  const schedulePayload =
    scheduleSettled.status === "fulfilled" ? scheduleSettled.value : null;
  const rosterPayload = rosterSettled.status === "fulfilled" ? rosterSettled.value : null;
  const games = parseScheduleEvents(
    schedulePayload ? schedulePayload.events : [],
    team.id,
    league.id
  );
  const roster = rosterPayload
    ? parseRosterAthletes(rosterPayload)
    : { players: [], coach: null };

  return assembleTeamPage({
    team,
    games,
    players: roster.players,
    coach: roster.coach,
    league: league.id,
  });
}

export function teamHref(teamId: string, league: LeagueId = DEFAULT_LEAGUE): string {
  const path = `/team/${encodeURIComponent(teamId)}`;
  return league === DEFAULT_LEAGUE ? path : `${path}?league=${league}`;
}
