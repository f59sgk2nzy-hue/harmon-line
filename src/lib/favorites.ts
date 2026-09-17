import { DEFAULT_LEAGUE, LEAGUE_IDS, favoriteKey, parseLeagueParam } from "@/lib/leagues";
import type { GameSummary, LeagueId } from "@/lib/types";

export const FAVORITES_STORAGE_KEY = "harmon-line:favorites";
export const FAVORITES_CHANGE_EVENT = "harmon-line:favorites";

export type FavoritePin = {
  league: LeagueId;
  teamId: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  color: string | null;
};

export type FavoritesSnapshot = {
  demo: false;
  pins: FavoritePin[];
};

export type FavoritesStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

const LEAGUE_SET = new Set<string>(LEAGUE_IDS);

function isLeagueId(value: string): value is LeagueId {
  return LEAGUE_SET.has(value);
}

export function emptyFavorites(): FavoritesSnapshot {
  return { demo: false, pins: [] };
}

export function parseFavoriteKey(
  value: string | null | undefined
): { league: LeagueId; teamId: string } | null {
  const raw = (value ?? "").trim();
  const colon = raw.indexOf(":");
  if (colon <= 0) return null;
  const leagueSlug = raw.slice(0, colon).toLowerCase();
  const teamId = raw.slice(colon + 1).trim();
  if (!teamId || !isLeagueId(leagueSlug)) return null;
  return { league: leagueSlug, teamId };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePin(value: unknown): FavoritePin | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const league = str(rec.league).toLowerCase();
  if (!isLeagueId(league)) return null;
  const teamId = str(rec.teamId);
  if (!teamId) return null;
  const name = str(rec.name);
  if (!name) return null;
  const abbreviation = str(rec.abbreviation) || teamId;
  const shortName = str(rec.shortName) || name;
  const logo = typeof rec.logo === "string" ? rec.logo : "";
  const color = typeof rec.color === "string" && rec.color.trim() ? rec.color : null;
  return { league, teamId, name, shortName, abbreviation, logo, color };
}

export function parseFavoritesPayload(raw: string | null | undefined): FavoritesSnapshot {
  if (!raw || !raw.trim()) return emptyFavorites();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyFavorites();
    const rec = parsed as Record<string, unknown>;
    if (rec.demo === true) return emptyFavorites();
    const rows = Array.isArray(rec.pins) ? rec.pins : [];
    const seen = new Set<string>();
    const pins: FavoritePin[] = [];
    for (const row of rows) {
      const pin = parsePin(row);
      if (!pin) continue;
      const key = favoriteKey(pin.league, pin.teamId);
      if (seen.has(key)) continue;
      seen.add(key);
      pins.push(pin);
    }
    return { demo: false, pins };
  } catch {
    return emptyFavorites();
  }
}

export function pinFromTeam(
  league: LeagueId,
  team: {
    id: string;
    name: string;
    shortName?: string;
    abbreviation: string;
    logo: string;
    color?: string | null;
  }
): FavoritePin {
  return {
    league: parseLeagueParam(league),
    teamId: team.id,
    name: team.name,
    shortName: team.shortName?.trim() || team.name,
    abbreviation: team.abbreviation,
    logo: team.logo,
    color: team.color ?? null,
  };
}

export function memoryFavoritesStore(initial: Record<string, string> = {}): FavoritesStore {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

export function loadFavorites(store: FavoritesStore): FavoritesSnapshot {
  try {
    return parseFavoritesPayload(store.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return emptyFavorites();
  }
}

export function saveFavorites(store: FavoritesStore, snapshot: FavoritesSnapshot): void {
  const next: FavoritesSnapshot = { demo: false, pins: snapshot.pins };
  try {
    store.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
  }
}

export function toggleFavoritePin(snapshot: FavoritesSnapshot, pin: FavoritePin): FavoritesSnapshot {
  const key = favoriteKey(pin.league, pin.teamId);
  const exists = snapshot.pins.some((row) => favoriteKey(row.league, row.teamId) === key);
  const pins = exists
    ? snapshot.pins.filter((row) => favoriteKey(row.league, row.teamId) !== key)
    : [pin, ...snapshot.pins.filter((row) => favoriteKey(row.league, row.teamId) !== key)];
  return { demo: false, pins };
}

export function favoriteKeySet(pins: FavoritePin[]): Set<string> {
  return new Set(pins.map((pin) => favoriteKey(pin.league, pin.teamId)));
}

export function isFavoritePinned(
  pins: FavoritePin[],
  league: LeagueId,
  teamId: string
): boolean {
  return favoriteKeySet(pins).has(favoriteKey(league, teamId));
}

export function gameHasFavorite(
  game: GameSummary,
  league: LeagueId,
  keys: Set<string>
): boolean {
  return keys.has(favoriteKey(league, game.away.id)) || keys.has(favoriteKey(league, game.home.id));
}

export function prioritizeFavoriteGames(
  games: GameSummary[],
  league: LeagueId,
  keys: Set<string>
): GameSummary[] {
  if (keys.size === 0) return games.slice();
  const favored: GameSummary[] = [];
  const rest: GameSummary[] = [];
  for (const game of games) {
    (gameHasFavorite(game, league, keys) ? favored : rest).push(game);
  }
  return favored.concat(rest);
}

export type FavoritePinGroup = {
  league: LeagueId;
  pins: FavoritePin[];
};

export function groupFavoritePins(pins: FavoritePin[], current: LeagueId = DEFAULT_LEAGUE): FavoritePinGroup[] {
  const byLeague = new Map<LeagueId, FavoritePin[]>();
  const order: LeagueId[] = [];
  for (const pin of pins) {
    if (!byLeague.has(pin.league)) {
      order.push(pin.league);
      byLeague.set(pin.league, []);
    }
    byLeague.get(pin.league)!.push(pin);
  }
  const rest = order.filter((id) => id !== current);
  const leagues = byLeague.has(current) ? [current, ...rest] : rest;
  return leagues.map((league) => ({ league, pins: byLeague.get(league) ?? [] }));
}
