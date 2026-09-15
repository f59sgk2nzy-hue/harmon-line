import { isEspnDate, todayEspnDate } from "@/lib/dates";

export const REGULAR_SEASON_TYPE = 2;
export const MAX_REGULAR_WEEK = 20;

export type ScoreboardViewMode = "date" | "week";

export type EspnCalendarWeek = {
  number: number;
  label: string;
  detail: string;
  startDate: string;
  endDate: string;
  startEspnDate: string;
  seasonType: number;
};

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

/** CFB week numbers ESPN actually publishes (regular season v0). */
export function parseWeekParam(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > MAX_REGULAR_WEEK) return null;
  return week;
}

/** v0 is regular season only (`seasontype=2`). Preseason/postseason stay a follow-up. */
export function parseSeasonType(_value: string | null | undefined): number {
  return REGULAR_SEASON_TYPE;
}

export function parseSeasonYear(
  value: string | null | undefined,
  fallbackDate?: string | null
): number | null {
  if (value && /^\d{4}$/.test(value)) return Number(value);
  if (fallbackDate && isEspnDate(fallbackDate)) return Number(fallbackDate.slice(0, 4));
  return null;
}

export function isoToEspnDateEastern(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return todayEspnDate(date);
}

/** ~noon US/Eastern for an ESPN YYYYMMDD calendar day (EDT 12:00 / EST 11:00). */
export function espnDateUtcMs(yyyymmdd: string): number {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  return Date.UTC(year, month - 1, day, 16, 0, 0);
}

export function parseRegularSeasonWeeks(payload: unknown): EspnCalendarWeek[] {
  const root = asRecord(payload);
  const leagues = asArray(root?.leagues);
  const league = asRecord(leagues[0]);
  const buckets = asArray(league?.calendar);
  const weeks: EspnCalendarWeek[] = [];

  for (const bucket of buckets) {
    const row = asRecord(bucket);
    if (!row) continue;
    const seasonType = num(row.value);
    if (seasonType !== REGULAR_SEASON_TYPE) continue;
    for (const entry of asArray(row.entries)) {
      const item = asRecord(entry);
      if (!item) continue;
      const number = num(item.value);
      const startDate = str(item.startDate);
      const endDate = str(item.endDate);
      if (!number || number < 1 || !startDate || !endDate) continue;
      const startEspnDate = isoToEspnDateEastern(startDate);
      if (!isEspnDate(startEspnDate)) continue;
      weeks.push({
        number,
        label: str(item.label, `Week ${number}`),
        detail: str(item.detail),
        startDate,
        endDate,
        startEspnDate,
        seasonType: REGULAR_SEASON_TYPE,
      });
    }
  }

  return weeks.sort((a, b) => a.number - b.number);
}

export function weekForEspnDate(
  date: string,
  weeks: EspnCalendarWeek[]
): EspnCalendarWeek | null {
  if (!isEspnDate(date) || weeks.length === 0) return null;
  const instant = espnDateUtcMs(date);
  return (
    weeks.find((week) => {
      const start = Date.parse(week.startDate);
      const end = Date.parse(week.endDate);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return instant >= start && instant <= end;
    }) ?? null
  );
}

export function espnScoreboardPath(options: {
  group: string;
  date: string;
  week?: number | null;
  year?: number | null;
  seasonType?: number | null;
  view?: ScoreboardViewMode;
  limit?: number;
}): string {
  const limit = options.limit ?? 300;
  const week = options.week;
  const view = options.view ?? (week ? "week" : "date");
  if (view === "week" && week) {
    const year = options.year ?? parseSeasonYear(null, options.date);
    const seasonType = options.seasonType ?? REGULAR_SEASON_TYPE;
    const yearPart = year ? `&dates=${year}` : "";
    return `/scoreboard?groups=${options.group}&week=${week}&seasontype=${seasonType}${yearPart}&limit=${limit}`;
  }
  return `/scoreboard?groups=${options.group}&dates=${options.date}&limit=${limit}`;
}
