"use client";

import { FilterChip } from "@/components/filter-chip";
import type { ScoreboardWeek } from "@/lib/types";
import { useEffect, useRef } from "react";

export function WeekStrip({
  weeks,
  selectedWeek,
  hrefFor,
}: {
  weeks: ScoreboardWeek[];
  selectedWeek: number | null;
  hrefFor: (week: ScoreboardWeek) => string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = scrollerRef.current?.querySelector<HTMLElement>("[data-week-active='true']");
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedWeek, weeks.length]);

  if (weeks.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="shrink-0 font-display text-[10px] tracking-[0.18em] text-[#f3c14b]">WEEK</p>
      <div
        ref={scrollerRef}
        className="week-scroller flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5"
        role="listbox"
        aria-label="College football week"
        aria-orientation="horizontal"
      >
        {weeks.map((week) => {
          const active = selectedWeek === week.number;
          return (
            <div
              key={week.number}
              data-week-active={active ? "true" : "false"}
              className="shrink-0"
            >
              <FilterChip
                href={hrefFor(week)}
                active={active}
                tone="red"
                className="week-chip font-display text-[11px] tracking-[0.14em]"
              >
                WK {week.number}
                {week.detail ? (
                  <span className="ml-1.5 hidden font-mono text-[10px] tracking-normal opacity-80 sm:inline">
                    {week.detail}
                  </span>
                ) : null}
              </FilterChip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
