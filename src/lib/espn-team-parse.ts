import { conferenceLabel } from "@/lib/conferences";
import {
  classifySubdivision,
  collectClassificationIds,
  ESPN_NCAAF_LEAGUE_ID,
  GROUP_CLASSIFICATION,
} from "@/lib/espn-parse";
import type {
  Classification,
  CoverageNote,
  GameState,
  RosterPlayer,
  TeamCoach,
  TeamFeedStatus,
  TeamProfile,
  TeamScheduleGame,
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

export function teamLogo(teamId: string): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

const DIVISION_BUCKET_IDS = new Set([
  ESPN_NCAAF_LEAGUE_ID,
  ...Object.keys(GROUP_CLASSIFICATION),
]);

export function parseTeamId(value: string | null | undefined): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return value;
}

export function parseCompetitorScore(value: unknown): number | null {
  const direct = num(value);
  if (direct != null) return direct;
  const rec = asRecord(value);
  if (!rec) return null;
  return num(rec.value) ?? num(rec.displayValue);
}

function parseState(value: unknown): GameState {
  const state = str(value);
  if (state === "in" || state === "pre" || state === "post") return state;
  return "pre";
}

function conferenceFromGroups(groups: Json | null): string | null {
  if (!groups) return null;
  const id = str(groups.id);
  if (!id || DIVISION_BUCKET_IDS.has(id)) return null;
  if (groups.isConference === false) return null;
  return id;
}

export function parseTeamProfile(raw: unknown): TeamProfile | null {
  const root = asRecord(raw);
  const team = asRecord(root?.team) ?? root;
  if (!team) return null;
  const id = str(team.id);
  if (!id) return null;

  const records = asArray(asRecord(team.record)?.items);
  const overall =
    records
      .map(asRecord)
      .find((row) => row && (row.type === "total" || row.abbreviation === "overall")) ??
    asRecord(records[0]);

  const groups = asRecord(team.groups);
  const conferenceId = conferenceFromGroups(groups);
  const ids = collectClassificationIds(team, groups, asRecord(groups?.parent));
  const subdivision = classifySubdivision(ids);

  return {
    id,
    name: str(team.displayName || team.name, "Unknown"),
    shortName: str(team.shortDisplayName || team.nickname || team.abbreviation || team.name, "UNK"),
    abbreviation: str(team.abbreviation, "UNK").toUpperCase(),
    nickname: str(team.nickname) || null,
    location: str(team.location) || null,
    color: hexColor(team.color),
    altColor: hexColor(team.alternateColor),
    logo: teamLogo(id),
    record: overall ? str(overall.summary) || str(team.recordSummary) || null : str(team.recordSummary) || null,
    standingSummary: str(team.standingSummary) || null,
    conferenceId,
    conferenceName: conferenceLabel(conferenceId),
    subdivision,
  };
}

function parseBroadcast(competition: Json): string | null {
  const broadcasts = asArray(competition.broadcasts);
  const first = asRecord(broadcasts[0]);
  if (!first) return str(competition.broadcast) || null;
  const media = asRecord(first.media);
  const names = asArray(first.names).map((n) => str(n)).filter(Boolean);
  return str(media?.shortName) || names[0] || str(first.shortName) || null;
}

function opponentFromCompetitor(raw: Json | null): TeamScheduleGame["opponent"] | null {
  if (!raw) return null;
  const team = asRecord(raw.team) ?? raw;
  const id = str(team.id || raw.id);
  if (!id) return null;
  return {
    id,
    name: str(team.displayName || team.name, "Unknown"),
    shortName: str(team.shortDisplayName || team.abbreviation || team.name, "UNK"),
    abbreviation: str(team.abbreviation, "UNK").toUpperCase(),
    logo: teamLogo(id),
  };
}

export function parseScheduleGames(raw: unknown, teamId: string): TeamScheduleGame[] {
  const root = asRecord(raw);
  const events = asArray(root?.events ?? raw);
  const games: TeamScheduleGame[] = [];

  for (const eventRaw of events) {
    const event = asRecord(eventRaw);
    if (!event) continue;
    const competition = asRecord(asArray(event.competitions)[0]) ?? event;
    const competitors = asArray(competition.competitors).map(asRecord);
    const self = competitors.find((row) => {
      const team = asRecord(row?.team);
      return str(team?.id || row?.id) === teamId;
    });
    const other = competitors.find((row) => {
      const team = asRecord(row?.team);
      return str(team?.id || row?.id) !== teamId;
    });
    if (!self || !other) continue;

    const opponent = opponentFromCompetitor(other);
    if (!opponent) continue;

    const status = asRecord(event.status) ?? asRecord(competition.status) ?? {};
    const statusType = asRecord(status.type) ?? {};
    const week = asRecord(event.week);
    const venue = asRecord(competition.venue);
    const state = parseState(statusType.state);
    const completed = Boolean(statusType.completed) || state === "post";
    const winnerRaw = self.winner;
    const winner = typeof winnerRaw === "boolean" && completed ? winnerRaw : null;
    const homeAway: TeamScheduleGame["homeAway"] = competition.neutralSite
      ? "neutral"
      : self.homeAway === "away"
        ? "away"
        : "home";

    games.push({
      id: str(event.id || competition.id),
      date: str(event.date || competition.date),
      week: num(week?.number),
      name: str(event.name, `${opponent.name}`),
      shortName: str(event.shortName, opponent.abbreviation),
      status: {
        state,
        detail: str(statusType.detail || statusType.description, "Scheduled"),
        shortDetail: str(statusType.shortDetail || statusType.detail, "Scheduled"),
        period: num(status.period),
        clock: str(status.displayClock) || null,
        completed,
      },
      venue: str(venue?.fullName) || null,
      broadcast: parseBroadcast(competition),
      homeAway,
      opponent,
      teamScore: parseCompetitorScore(self.score),
      opponentScore: parseCompetitorScore(other.score),
      winner,
    });
  }

  return games;
}

export function splitTeamSchedule(games: TeamScheduleGame[]): {
  recent: TeamScheduleGame[];
  upcoming: TeamScheduleGame[];
} {
  const recent = games
    .filter((game) => game.status.state === "post")
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const upcoming = games
    .filter((game) => game.status.state !== "post")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { recent, upcoming };
}

function playerGroup(bucket: string, position: Json | null): string {
  if (bucket) return bucket;
  const parent = asRecord(position?.parent);
  const abbr = str(parent?.abbreviation || position?.abbreviation).toUpperCase();
  if (abbr === "OFF" || abbr === "OFFENSE") return "offense";
  if (abbr === "DEF" || abbr === "DEFENSE") return "defense";
  if (abbr === "ST" || abbr === "SPECIAL TEAMS") return "specialTeam";
  return "other";
}

export function parseRoster(raw: unknown): { players: RosterPlayer[]; coach: TeamCoach | null } {
  const root = asRecord(raw);
  const players: RosterPlayer[] = [];

  for (const groupRaw of asArray(root?.athletes)) {
    const group = asRecord(groupRaw);
    if (!group) continue;
    const bucket = str(group.position);
    for (const item of asArray(group.items)) {
      const athlete = asRecord(item);
      if (!athlete) continue;
      const name = str(athlete.displayName || athlete.fullName || athlete.shortName);
      if (!name) continue;
      const id = str(athlete.id);
      if (!id) continue;
      const position = asRecord(athlete.position);
      const experience = asRecord(athlete.experience);
      const birthPlace = asRecord(athlete.birthPlace);
      const jerseyValue = athlete.jersey;
      const jersey =
        typeof jerseyValue === "number" && Number.isFinite(jerseyValue)
          ? String(jerseyValue)
          : str(jerseyValue) || null;

      players.push({
        id,
        name,
        jersey,
        position: str(position?.abbreviation || position?.displayName) || null,
        group: playerGroup(bucket, position),
        year: str(experience?.abbreviation || experience?.displayValue) || null,
        hometown: str(birthPlace?.displayText) ||
          [str(birthPlace?.city), str(birthPlace?.state)].filter(Boolean).join(", ") ||
          null,
        height: str(athlete.displayHeight) || null,
        weight: str(athlete.displayWeight) || null,
      });
    }
  }

  const coachRaw = asRecord(asArray(root?.coach)[0]);
  const coachName = coachRaw
    ? [str(coachRaw.firstName), str(coachRaw.lastName)].filter(Boolean).join(" ") ||
      str(coachRaw.displayName)
    : "";
  const coach =
    coachRaw && str(coachRaw.id) && coachName
      ? { id: str(coachRaw.id), name: coachName }
      : null;

  return { players, coach };
}

export function teamScheduleCoverage(
  games: TeamScheduleGame[],
  subdivision: Classification | null,
  feed: TeamFeedStatus
): CoverageNote {
  if (feed === "error") {
    return {
      headline: "Schedule feed unavailable",
      detail:
        "Could not reach ESPN’s public team schedule. Recent scores are never invented when the feed is down.",
    };
  }
  if (games.length > 0) {
    return {
      headline: "Season schedule from ESPN team feed",
      detail:
        "Recent results and upcoming games come from the public ESPN `/teams/{id}/schedule` endpoint. Missing scores stay blank.",
    };
  }
  if (subdivision === "NAIA") {
    return {
      headline: "No schedule on this feed",
      detail:
        "ESPN often publishes little or no NAIA schedule. Games and scores are never invented.",
    };
  }
  if (subdivision === "D2" || subdivision === "D3") {
    return {
      headline: "No schedule published",
      detail:
        "ESPN has not published a season schedule for this Division II/III team. Games are never invented.",
    };
  }
  return {
    headline: "No schedule published",
    detail: "ESPN has not published a season schedule for this team. Games are never invented.",
  };
}

export function teamRosterCoverage(
  playerCount: number,
  subdivision: Classification | null,
  feed: TeamFeedStatus
): CoverageNote {
  if (feed === "error") {
    return {
      headline: "Roster feed unavailable",
      detail:
        "Could not reach ESPN’s public team roster. Players are never invented when the feed is down.",
    };
  }
  if (playerCount > 0) {
    return {
      headline: "Roster from ESPN team feed",
      detail: "Players listed below were published on the public ESPN `/teams/{id}/roster` endpoint.",
    };
  }
  if (subdivision === "NAIA") {
    return {
      headline: "No roster on this feed",
      detail:
        "ESPN rarely publishes full NAIA rosters. Players are never invented.",
    };
  }
  if (subdivision === "D2" || subdivision === "D3") {
    return {
      headline: "No roster published",
      detail:
        "ESPN has not published a roster for this Division II/III team. Players are never invented.",
    };
  }
  return {
    headline: "No roster published",
    detail: "ESPN has not published a roster for this team. Players are never invented.",
  };
}
