"use client";

import {
  FAVORITES_CHANGE_EVENT,
  FAVORITES_STORAGE_KEY,
  emptyFavorites,
  favoriteKeySet,
  parseFavoritesPayload,
  saveFavorites,
  toggleFavoritePin,
  type FavoritePin,
  type FavoritesSnapshot,
} from "@/lib/favorites";
import { favoriteKey } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";
import { useCallback, useMemo, useSyncExternalStore } from "react";

let cachedRaw: string | null = null;
let cachedSnapshot: FavoritesSnapshot = emptyFavorites();

function readClientSnapshot(): FavoritesSnapshot {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    cachedSnapshot = parseFavoritesPayload(raw);
    return cachedSnapshot;
  } catch {
    return emptyFavorites();
  }
}

function subscribe(onStoreChange: () => void) {
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener(FAVORITES_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FAVORITES_CHANGE_EVENT, onChange);
  };
}

export function useFavorites() {
  const snapshot = useSyncExternalStore(subscribe, readClientSnapshot, emptyFavorites);
  const keys = useMemo(() => favoriteKeySet(snapshot.pins), [snapshot]);

  const toggle = useCallback(
    (pin: FavoritePin) => {
      saveFavorites(window.localStorage, toggleFavoritePin(snapshot, pin));
    },
    [snapshot]
  );

  const pinned = useCallback(
    (league: LeagueId, teamId: string) => keys.has(favoriteKey(league, teamId)),
    [keys]
  );

  return { snapshot, keys, toggle, pinned };
}
