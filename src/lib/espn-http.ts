import { DEFAULT_LEAGUE, parseLeagueParam } from "@/lib/leagues";
import {
  DEFAULT_ESPN_SITE_ORIGIN,
  DEFAULT_ESPN_WEB_ORIGIN,
  espnRequestUrl,
  originFromEnv,
} from "@/lib/espn-path";
import type { LeagueId } from "@/lib/types";

export const FETCH_TIMEOUT_MS = 12_000;

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

export function espnWebOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return originFromEnv(env.ESPN_WEB_BASE, DEFAULT_ESPN_WEB_ORIGIN);
}

export function espnSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return originFromEnv(env.ESPN_SITE_BASE, DEFAULT_ESPN_SITE_ORIGIN);
}

export async function espnGet(
  path: string,
  league: LeagueId = DEFAULT_LEAGUE
): Promise<Json> {
  const spec = parseLeagueParam(league);
  const bases = [espnWebOrigin(), espnSiteOrigin()];
  let lastError: Error | null = null;

  for (const base of bases) {
    const url = espnRequestUrl(base, spec, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "HarmonLine/1.0 (live scoreboard; +https://localhost)",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`ESPN ${response.status} from ${base}`);
        continue;
      }
      const data = (await response.json()) as unknown;
      const record = asRecord(data);
      if (!record) {
        lastError = new Error("ESPN returned a non-object payload");
        continue;
      }
      return record;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Unable to reach ESPN public APIs");
}
