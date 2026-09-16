import { EmptyState } from "@/components/empty-state";
import { sportBoardHref, sportResearchHref } from "@/lib/board-url";
import { getLeague } from "@/lib/leagues";
import type { ResearchBrief, ResearchFeed } from "@/lib/research";
import type { LeagueId } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function formatResearchWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function kindLabel(kind: ResearchBrief["kind"]): string {
  return kind === "deep-lore" ? "DEEP LORE" : "POST-GAME X-RAY";
}

function LineList({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) {
    return <p className="mt-1 font-mono text-[11px] text-white/50">{empty}</p>;
  }
  return (
    <ul className="mt-1 list-disc pl-4 font-mono text-[11px] leading-relaxed text-white/70">
      {lines.map((line, index) => (
        <li key={`${index}-${line.slice(0, 48)}`} className="mt-1 first:mt-0">
          {line}
        </li>
      ))}
    </ul>
  );
}

function HonestyBadges({ brief }: { brief: ResearchBrief }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      {brief.sample ? (
        <span
          data-sample
          className="inline-flex min-h-6 items-center rounded-sm bg-[#f3c14b] px-1.5 font-display text-[10px] tracking-[0.16em] text-black"
        >
          SAMPLE
        </span>
      ) : null}
      {brief.simulation ? (
        <span
          data-simulation
          className="inline-flex min-h-6 items-center rounded-sm bg-white/10 px-1.5 font-display text-[10px] tracking-[0.16em] text-[#f3c14b] ring-1 ring-[#f3c14b]/50"
        >
          SIMULATION
        </span>
      ) : null}
    </p>
  );
}

function BriefCard({ brief, league }: { brief: ResearchBrief; league: LeagueId }) {
  return (
    <Link
      href={sportResearchHref(league, brief.id)}
      className="block border border-white/10 bg-[#111] p-3 no-underline sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[10px] tracking-[0.18em] text-[#ff3b3b]">
          {kindLabel(brief.kind)}
        </p>
        <HonestyBadges brief={brief} />
      </div>
      <p className="mt-2 font-display text-lg tracking-[0.08em] text-white">{brief.title}</p>
      <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-white/45">
        {formatResearchWhen(brief.publishedAt)}
        {brief.league ? `  ·  ${brief.league.toUpperCase()}` : ""}
        {brief.gameId ? `  ·  GAME ${brief.gameId}` : ""}
      </p>
      <p className="mt-2 font-mono text-[11px] text-white/55">
        {brief.evidence.length} EVIDENCE  ·  {brief.inference.length} INFERENCE
      </p>
    </Link>
  );
}

function BriefDetail({ brief }: { brief: ResearchBrief }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-white/10 bg-[#111] px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
            {kindLabel(brief.kind)}
          </p>
          <HonestyBadges brief={brief} />
        </div>
        <h2 className="mt-2 font-display text-xl tracking-[0.1em] text-white sm:text-2xl">
          {brief.title}
        </h2>
        <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-white/35">
          {formatResearchWhen(brief.publishedAt)}
          {brief.league ? `  ·  ${brief.league.toUpperCase()}` : ""}
          {brief.gameId ? `  ·  GAME ${brief.gameId}` : ""}
          {"  ·  DEMO FALSE"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section data-evidence className="border border-white/10 bg-[#111] p-3 sm:p-4">
          <p className="font-display text-[10px] tracking-[0.16em] text-[#8ee08e]">EVIDENCE</p>
          <LineList
            lines={brief.evidence}
            empty="No published evidence cells in this brief."
          />
        </section>
        <section data-inference className="border border-white/10 bg-[#111] p-3 sm:p-4">
          <p className="font-display text-[10px] tracking-[0.16em] text-[#f3c14b]">INFERENCE</p>
          <LineList
            lines={brief.inference}
            empty="No inference. Missing data stays blank — never invented."
          />
        </section>
      </div>

      {brief.narrative ? (
        <article data-narrative className="border border-white/10 bg-[#0e0e0e] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-[10px] tracking-[0.16em] text-white/40">NARRATIVE</p>
            {brief.simulation ? (
              <span
                data-simulation
                className="inline-flex min-h-6 items-center rounded-sm bg-white/10 px-1.5 font-display text-[10px] tracking-[0.16em] text-[#f3c14b] ring-1 ring-[#f3c14b]/50"
              >
                SIMULATION
              </span>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80">
            {brief.narrative}
          </p>
        </article>
      ) : null}

      {brief.sources.length > 0 ? (
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/40">
          SOURCES  ·  {brief.sources.map((src) => src.label).join("  ·  ")}
        </p>
      ) : null}
    </div>
  );
}

export function ResearchView({
  league,
  feed,
  selected,
  requestedId = null,
}: {
  league: LeagueId;
  feed: ResearchFeed;
  selected: ResearchBrief | null;
  requestedId?: string | null;
}) {
  const spec = getLeague(league);
  const olderLore = feed.briefs.filter(
    (brief) => brief.kind === "deep-lore" && brief.id !== feed.latestDeepLore?.id
  );
  const missingRequested = Boolean(requestedId) && !selected;
  const empty = feed.briefs.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={selected || missingRequested ? sportResearchHref(league) : sportBoardHref(league)}
          transitionTypes={["nav-back"]}
          className="inline-flex min-h-11 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70 no-underline"
        >
          <ArrowLeft className="size-3.5" />
          {selected || missingRequested ? "RESEARCH" : "BOARD"}
        </Link>
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
          {spec.shortLabel}  ·  DEEP LORE + X-RAY V0  ·  DISK FEED  ·  DEMO FALSE
        </p>
      </div>

      <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
        EVIDENCE VS INFERENCE  ·  NEVER INVENT ANOMALIES
      </p>
      <h1 className="mt-1 font-display text-2xl tracking-[0.12em] text-white sm:text-3xl">
        RESEARCH
      </h1>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-white/58">
        Read-only Deep Lore briefs and Post-Game Tactical X-Rays written by Board
        routines. Drop JSON or markdown into <span className="font-mono">public/research/</span>{" "}
        on this machine, or set <span className="font-mono">RESEARCH_DIR</span>. Model copy
        wears a SIMULATION badge. Scores, WPA, and odds are never invented.
      </p>

      <div className="mt-4 border border-white/10 bg-[#111] px-3 py-3 sm:px-4">
        <p className="font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
          {missingRequested ? "NO BRIEF ON THIS FEED YET" : feed.honesty.headline}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/55">
          {missingRequested
            ? "That id is not on disk. Anomalies and WPA are never invented to fill a missing brief."
            : feed.honesty.detail}
        </p>
      </div>

      {missingRequested ? (
        <div className="mt-6">
          <EmptyState
            kicker="RESEARCH V0"
            headline="NO BRIEF ON THIS FEED YET"
            detail="The requested id is not on this feed. Nothing is invented in its place."
            action={
              <Link
                href={sportResearchHref(league)}
                className="inline-flex min-h-11 items-center font-display text-xs tracking-[0.16em] text-white/80"
              >
                BACK TO RESEARCH
              </Link>
            }
          />
        </div>
      ) : selected ? (
        <div className="mt-6">
          <BriefDetail brief={selected} />
        </div>
      ) : empty ? (
        <div className="mt-6">
          <EmptyState
            kicker="RESEARCH V0"
            headline="NO BRIEF ON THIS FEED YET"
            detail="Nothing is staged on disk. Copy a Board cron file into public/research/ or research/, then refresh. This panel will not invent an anomaly, WPA, or score to fill the hole."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <section>
            <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
              LATEST DEEP LORE
            </p>
            {feed.latestDeepLore ? (
              <BriefCard brief={feed.latestDeepLore} league={league} />
            ) : (
              <EmptyState
                kicker="DEEP LORE"
                headline="NO BRIEF ON THIS FEED YET"
                detail="No Deep Lore file is staged. X-Rays below (if any) are a separate feed."
              />
            )}
            {olderLore.length > 0 ? (
              <div className="mt-3 flex flex-col gap-3">
                {olderLore.map((brief) => (
                  <BriefCard key={brief.id} brief={brief} league={league} />
                ))}
              </div>
            ) : null}
          </section>

          <section>
            <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
              POST-GAME X-RAY
            </p>
            {feed.xrays.length === 0 ? (
              <EmptyState
                kicker="X-RAY"
                headline="NO BRIEF ON THIS FEED YET"
                detail="No Post-Game Tactical X-Ray is staged on this feed."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {feed.xrays.map((brief) => (
                  <BriefCard key={brief.id} brief={brief} league={league} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
