import { FilterChip } from "@/components/filter-chip";
import { OpsGraphMap, OpsRosterList } from "@/components/ops-graph";
import { sportBoardHref, sportOpsHref } from "@/lib/board-url";
import { parseBusyParam, workIsActive, type OpsGraph } from "@/lib/ops";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { LeagueId } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function busyKey(value: string | null): string {
  return parseBusyParam(value).join(",");
}

export function OpsView({
  graph,
  league = DEFAULT_LEAGUE,
  busyParam = null,
}: {
  graph: OpsGraph;
  league?: LeagueId;
  busyParam?: string | null;
}) {
  const spec = getLeague(league);
  const current = busyKey(busyParam);
  const active = workIsActive(graph);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 bg-[#0e0e0e]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={sportBoardHref(league)}
              transitionTypes={["nav-back"]}
              className="pressable inline-flex min-h-10 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70 no-underline"
            >
              <ArrowLeft className="size-3.5" />
              BOARD
            </Link>
            <p className="font-mono text-[10px] tracking-[0.12em] text-white/50">
              {spec.shortLabel}
              {active ? "  ·  WORK ACTIVE" : "  ·  IDLE"}
              {graph.busyOverride ? "  ·  DOGFOOD" : ""}
            </p>
          </div>
          <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
            {graph.honesty.headline}
          </p>
          <p className="max-w-2xl font-sans text-sm leading-relaxed text-white/58">
            {graph.honesty.detail}
          </p>
          <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
            <FilterChip
              href={sportOpsHref(league)}
              active={current === ""}
              tone="default"
              className="chip-hit-lg shrink-0"
            >
              IDLE
            </FilterChip>
            <FilterChip
              href={sportOpsHref(league, "board")}
              active={current === "the-board"}
              tone="red"
              className="chip-hit-lg shrink-0"
            >
              BOARD BUSY
            </FilterChip>
            <FilterChip
              href={sportOpsHref(league, "hub")}
              active={current === "chief-keef"}
              tone="red"
              className="chip-hit-lg shrink-0"
            >
              HUB BUSY
            </FilterChip>
            <FilterChip
              href={sportOpsHref(league, "all")}
              active={current === "chief-keef,the-board"}
              tone="red"
              className="chip-hit-lg shrink-0"
            >
              ALL ACTIVE
            </FilterChip>
          </div>
          <p className="font-mono text-[10px] tracking-wide text-white/45">
            DOGFOOD CHIPS SET ?busy= · NOT A LIVE AGENT FEED · demo: false
          </p>
        </div>
      </div>
      <main className="page-enter mx-auto w-full max-w-5xl flex-1 px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
        <section className="board-glass overflow-hidden px-2 py-4 sm:px-4 sm:py-6">
          <OpsGraphMap graph={graph} league={league} />
        </section>
        <section className="mt-4 board-glass overflow-hidden">
          <p className="border-b border-white/10 px-3 py-2 font-display text-[11px] tracking-[0.22em] text-[#f3c14b] sm:px-4">
            ROSTER
          </p>
          <OpsRosterList graph={graph} league={league} />
        </section>
      </main>
    </div>
  );
}
