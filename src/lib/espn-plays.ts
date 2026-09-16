import type { LeaderLine, PlayByPlayPlay, ScoringPlay } from "@/lib/types";

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

export function parsePlay(raw: unknown): PlayByPlayPlay | null {
  const play = asRecord(raw);
  if (!play) return null;
  const period = asRecord(play.period);
  const clock = asRecord(play.clock);
  const type = asRecord(play.type);
  const participants = asArray(play.teamParticipants).map(asRecord);
  const offense = participants.find((row) => row?.type === "offense");
  const team = asRecord(play.team) ?? asRecord(offense?.team);
  const text = str(play.text);
  if (!text) return null;
  return {
    id: str(play.id || play.sequenceNumber, crypto.randomUUID()),
    text,
    period: num(period?.number),
    clock: str(clock?.displayValue) || null,
    homeScore: num(play.homeScore),
    awayScore: num(play.awayScore),
    scoringPlay: Boolean(play.scoringPlay),
    type: str(type?.text) || null,
    teamId: str(team?.id) || str(offense?.id) || null,
  };
}

export function parsePlays(raw: unknown): PlayByPlayPlay[] {
  return asArray(raw)
    .map(parsePlay)
    .filter((play): play is PlayByPlayPlay => Boolean(play));
}

export function parseScoringPlay(raw: unknown): ScoringPlay | null {
  const play = asRecord(raw);
  if (!play) return null;
  const period = asRecord(play.period);
  const clock = asRecord(play.clock);
  const type = asRecord(play.type);
  const team = asRecord(play.team);
  const text = str(play.text);
  if (!text) return null;
  return {
    id: str(play.id, crypto.randomUUID()),
    text,
    period: num(period?.number),
    clock: str(clock?.displayValue) || null,
    homeScore: num(play.homeScore) ?? 0,
    awayScore: num(play.awayScore) ?? 0,
    teamId: str(team?.id) || null,
    teamName: str(team?.displayName) || null,
    type: str(type?.text) || null,
  };
}

function scoringPlayFromPbp(play: PlayByPlayPlay): ScoringPlay {
  return {
    id: play.id,
    text: play.text,
    period: play.period,
    clock: play.clock,
    homeScore: play.homeScore ?? 0,
    awayScore: play.awayScore ?? 0,
    teamId: play.teamId,
    teamName: null,
    type: play.type,
  };
}

export function parseScoringPlays(summary: unknown): ScoringPlay[] {
  const data = asRecord(summary) ?? {};
  const published = asArray(data.scoringPlays)
    .map(parseScoringPlay)
    .filter((row): row is ScoringPlay => Boolean(row));
  if (published.length > 0) return published;
  const derived: ScoringPlay[] = [];
  for (const raw of asArray(data.plays)) {
    const play = parsePlay(raw);
    if (!play?.scoringPlay) continue;
    const rec = asRecord(raw);
    const team = asRecord(rec?.team);
    derived.push({
      ...scoringPlayFromPbp(play),
      teamId: play.teamId || str(team?.id) || null,
      teamName: str(team?.displayName || team?.shortDisplayName) || null,
    });
  }
  return derived;
}

function parseLeaderCategory(cat: Json, fallbackTeamId: string | null): LeaderLine | null {
  const label = str(cat.displayName || cat.name, "Leader");
  const leaders = asArray(cat.leaders);
  const first = asRecord(leaders[0]);
  if (!first) return null;
  const athlete = asRecord(first.athlete) ?? asRecord(asArray(first.athletes)[0]);
  const team = asRecord(first.team);
  const name = str(athlete?.displayName || athlete?.fullName || first.displayValue);
  if (!name) return null;
  return {
    category: label,
    name,
    displayValue: str(first.displayValue),
    teamId: str(team?.id) || fallbackTeamId,
  };
}

export function parseLeaders(raw: unknown): LeaderLine[] {
  const lines: LeaderLine[] = [];
  for (const category of asArray(raw)) {
    const cat = asRecord(category);
    if (!cat) continue;
    const nested = asArray(cat.leaders);
    const nestedFirst = asRecord(nested[0]);
    if (nestedFirst && Array.isArray(nestedFirst.leaders)) {
      const team = asRecord(cat.team);
      const teamId = str(team?.id) || null;
      for (const inner of nested) {
        const innerCat = asRecord(inner);
        if (!innerCat) continue;
        const line = parseLeaderCategory(innerCat, teamId);
        if (line) lines.push(line);
      }
      continue;
    }
    const line = parseLeaderCategory(cat, null);
    if (line) lines.push(line);
  }
  return lines;
}
