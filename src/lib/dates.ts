const EASTERN = "America/New_York";

export function todayEspnDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}${month}${day}`;
}

export function espnDateToIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function isoToEspnDate(iso: string): string {
  return iso.replaceAll("-", "");
}

export function shiftEspnDate(yyyymmdd: string, days: number): string {
  const iso = espnDateToIso(yyyymmdd);
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatBoardDate(yyyymmdd: string): string {
  const iso = espnDateToIso(yyyymmdd);
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function isEspnDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{8}$/.test(value));
}

export function parseDateParam(value: string | null | undefined): string {
  if (isEspnDate(value)) return value;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoToEspnDate(value);
  }
  return todayEspnDate();
}
