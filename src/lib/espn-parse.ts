import { CONFERENCE_SUBDIVISION } from "./conferences";
import type { Classification, DivisionId } from "./types";

type Json = Record<string, unknown>;

/** ESPN sport-league id for NCAA football — not a subdivision group. */
export const ESPN_NCAAF_LEAGUE_ID = "23";

export const GROUP_CLASSIFICATION: Record<string, Classification> = {
  "80": "FBS",
  "81": "FCS",
  "57": "D2",
  "58": "D3",
  "186": "NAIA",
};

const CLASS_PRIORITY: Classification[] = ["NAIA", "D2", "D3", "FCS", "FBS"];

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

function pushId(ids: string[], value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    ids.push(String(value));
    return;
  }
  const text = str(value).trim();
  if (text) ids.push(text);
}

/** Period points from ESPN scoreboard (`value`) or summary (`displayValue` only). */
export function parseLinescores(value: unknown): Array<number | null> {
  const rows = asArray(value);
  if (rows.length === 0) return [];
  return rows.slice(0, 8).map((row) => {
    if (typeof row === "number" && Number.isFinite(row)) return row;
    const rec = asRecord(row);
    if (!rec) {
      return typeof row === "string" ? num(row) : null;
    }
    return num(rec.value) ?? num(rec.displayValue);
  });
}

export function collectClassificationIds(...nodes: unknown[]): string[] {
  const ids: string[] = [];

  const visit = (value: unknown, depth: number) => {
    if (depth > 5) return;
    const rec = asRecord(value);
    if (!rec) return;

    pushId(ids, rec.id);
    pushId(ids, rec.group);
    pushId(ids, rec.conferenceId);

    const groups = asRecord(rec.groups);
    if (groups) {
      pushId(ids, groups.id);
      visit(groups.parent, depth + 1);
    }

    const league = asRecord(rec.league);
    if (league) pushId(ids, league.id);

    const meta = asRecord(rec.meta);
    if (meta) pushId(ids, meta.group);

    for (const competition of asArray(rec.competitions)) {
      visit(competition, depth + 1);
    }
    for (const competitor of asArray(rec.competitors)) {
      visit(competitor, depth + 1);
      visit(asRecord(competitor)?.team, depth + 1);
    }
  };

  for (const node of nodes) visit(node, 0);
  return ids;
}

export function classifySubdivision(
  ids: Array<string | null | undefined>,
  division?: DivisionId
): Classification | null {
  const found = new Set<Classification>();

  for (const raw of ids) {
    if (raw == null || raw === "") continue;
    const id = String(raw);
    if (id === ESPN_NCAAF_LEAGUE_ID) continue;
    const fromGroup = GROUP_CLASSIFICATION[id];
    if (fromGroup) found.add(fromGroup);
    const fromConference = CONFERENCE_SUBDIVISION[id];
    if (fromConference) found.add(fromConference);
  }

  for (const cls of CLASS_PRIORITY) {
    if (found.has(cls)) return cls;
  }

  if (division === "naia") return "NAIA";
  if (division === "d2") return "D2";
  return null;
}

export function divisionFromClassification(classification: Classification): DivisionId {
  if (classification === "NAIA") return "naia";
  if (classification === "D2" || classification === "D3") return "d2";
  return "d1";
}

export function hasPeriodScores(lines: Array<number | null> | undefined): boolean {
  return Boolean(lines?.some((value) => value != null));
}

export function periodLabel(index: number): string {
  if (index < 4) return `Q${index + 1}`;
  return index === 4 ? "OT" : `${index - 3}OT`;
}
