"use client";

import { pinFromTeam } from "@/lib/favorites";
import { useFavorites } from "@/lib/use-favorites";
import type { LeagueId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export function FavoritePinButton({
  league,
  team,
  className,
}: {
  league: LeagueId;
  team: {
    id: string;
    name: string;
    shortName?: string;
    abbreviation: string;
    logo: string;
    color?: string | null;
  };
  className?: string;
}) {
  const { pinned, toggle } = useFavorites();
  const isPinned = pinned(league, team.id);
  const label = `${isPinned ? "Unpin" : "Pin"} ${team.shortName || team.name}`;

  return (
    <button
      type="button"
      aria-pressed={isPinned}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(pinFromTeam(league, team));
      }}
      className={cn(
        "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-sm sm:size-9",
        className
      )}
    >
      <Star
        className={
          isPinned ? "size-4 fill-[#f3c14b] text-[#f3c14b]" : "size-4 text-white/40"
        }
      />
    </button>
  );
}
