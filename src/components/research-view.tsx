"use client";

import { DisclaimerFooter, DisclaimerModal } from "@/components/disclaimer-modal";
import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { sportBoardHref, sportResearchAskHref, sportResearchHref } from "@/lib/board-url";
import { RESEARCH_BRIEF_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import { getLeague } from "@/lib/leagues";
import type { ResearchBrief, ResearchFeed } from "@/lib/research";
import type { ResearchAskResponse } from "@/lib/research-ask";
import type { LeagueId } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const EXAMPLES: Array<{ q: string; league: LeagueId; label: string }> = [
  { q: "Ohio State vs Texas recap", league: "cfb", label: "OSU vs TEX" },
  { q: "Where is Alabama ranked?", league: "cfb", label: "BAMA RANK" },
  { q: "Lakers vs Celtics", league: "nba", label: "LAL vs BOS" },
  { q: "World Series recap", league: "mlb", label: "WS RECAP" },
];

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

function AskAnswer({ data }: { data: ResearchAskResponse }) {
  const showDisclaimer = Boolean(data.rgDisclaimer);
  return (
    <div data-research-ask className="mt-4 space-y-4">
      {showDisclaimer && data.rgDisclaimer ? (
        <DisclaimerModal shortText={data.rgDisclaimer} longText={data.rgDisclaimer} />
      ) : null}

      <div className="border border-white/10 bg-[#111] px-3 py-3 sm:px-4">
        <p className="font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
          {data.honesty.headline}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/55">
          {data.honesty.detail}
        </p>
        <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-white/35">
          {data.league.toUpperCase()}  ·  {data.scope.toUpperCase()}  ·  DEMO{" "}
          {String(data.demo).toUpperCase()}
          {data.configured ? "  ·  GOOGLE CSE" : "  ·  GOOGLE SEARCH NOT CONFIGURED"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section data-evidence className="border border-white/10 bg-[#111] p-3 sm:p-4">
          <p className="font-display text-[10px] tracking-[0.16em] text-[#8ee08e]">
            EVIDENCE
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.1em] text-white/35">
            OBSERVED FROM GOOGLE RESULT SNIPPETS / TITLES / LINKS
          </p>
          <LineList
            lines={data.evidence}
            empty="No Google snippets on this feed. Sources are never invented."
          />
        </section>
        <section data-inference className="border border-white/10 bg-[#111] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-[10px] tracking-[0.16em] text-[#f3c14b]">
              INFERENCE
            </p>
            {data.simulation ? (
              <span
                data-simulation
                className="inline-flex min-h-6 items-center rounded-sm bg-white/10 px-1.5 font-display text-[10px] tracking-[0.16em] text-[#f3c14b] ring-1 ring-[#f3c14b]/50"
              >
                SIMULATION
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[10px] tracking-[0.1em] text-white/35">
            MODEL SYNTHESIS  ·  NOT A LIVE SCORE
          </p>
          <LineList
            lines={data.inference}
            empty="No inference. Missing data stays blank — never invented."
          />
        </section>
      </div>

      {data.sources.length > 0 ? (
        <nav data-research-sources aria-label="Google result links" className="border border-white/10 bg-[#0e0e0e] p-3 sm:p-4">
          <p className="font-display text-[10px] tracking-[0.16em] text-white/40">
            GOOGLE RESULT LINKS
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {data.sources.map((src, index) => (
              <li key={`${src.href}-${index}`} className="min-w-0">
                <a
                  href={src.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-sans text-sm text-[#8ec8ff] underline-offset-2 hover:underline"
                >
                  {src.title}
                </a>
                <p className="font-mono text-[10px] tracking-[0.08em] text-white/40">
                  {src.displayLink ?? src.href}
                </p>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {data.rgDisclaimer ? <DisclaimerFooter text={data.rgDisclaimer} /> : null}
    </div>
  );
}

function BriefList({ feed, league }: { feed: ResearchFeed; league: LeagueId }) {
  const olderLore = feed.briefs.filter(
    (brief) => brief.kind === "deep-lore" && brief.id !== feed.latestDeepLore?.id
  );
  const empty = feed.briefs.length === 0;

  if (empty) {
    return (
      <EmptyState
        kicker="RESEARCH V0"
        headline="NO BRIEF ON THIS FEED YET"
        detail="Nothing is staged on disk. Copy a Board cron file into public/research/ or research/, then wait for the next refresh. This panel will not invent an anomaly, WPA, or score to fill the hole."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
  );
}

export function ResearchView({
  league,
  feed,
  selected,
  requestedId = null,
  query = "",
  ask = null,
  googleConfigured = false,
}: {
  league: LeagueId;
  feed: ResearchFeed;
  selected: ResearchBrief | null;
  requestedId?: string | null;
  query?: string;
  ask?: ResearchAskResponse | null;
  googleConfigured?: boolean;
}) {
  const spec = getLeague(league);
  const missingRequested = Boolean(requestedId) && !selected;
  const [liveFeed, setLiveFeed] = useState(feed);

  useEffect(() => {
    setLiveFeed(feed);
  }, [feed]);

  const refreshBriefs = useCallback(async () => {
    try {
      const response = await fetch("/api/research", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as ResearchFeed;
      if (
        payload &&
        payload.demo === false &&
        Array.isArray(payload.briefs) &&
        payload.honesty &&
        typeof payload.honesty.headline === "string"
      ) {
        setLiveFeed(payload);
      }
    } catch {
      // Keep the last honest disk snapshot. Drops are never invented.
    }
  }, []);

  useLivePoll(refreshBriefs, {
    intervalMs: RESEARCH_BRIEF_REFRESH_MS,
    runOnMount: false,
  });

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
          {spec.shortLabel}  ·  DEEP LORE + GOOGLE ASK V0  ·  DEMO FALSE
        </p>
      </div>

      <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
        EVIDENCE VS INFERENCE  ·  NEVER INVENT ANOMALIES
      </p>
      <h1 className="mt-1 font-display text-2xl tracking-[0.12em] text-white sm:text-3xl">
        RESEARCH
      </h1>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-white/58">
        Ask a sports research question. Evidence is copied from Google result
        snippets, titles, and links when Programmable Search is configured.
        Inference is labeled SIMULATION. Briefs below are still read-only Deep
        Lore / X-Ray files from disk. Scores, WPA, and odds are never invented.
      </p>

      <form
        method="get"
        action="/research"
        className="mt-4 border border-white/10 bg-[#111] p-3 sm:p-4"
      >
        {league !== "cfb" ? <input type="hidden" name="league" value={league} /> : null}
        <label htmlFor="research-q" className="font-display text-[10px] tracking-[0.18em] text-white/45">
          QUESTION
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="research-q"
            name="q"
            defaultValue={query}
            placeholder="Ohio State vs Texas recap"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-sm border border-white/15 bg-black/40 px-3 font-sans text-sm text-white placeholder:text-white/30"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[#cc0000] px-4 font-display text-[11px] tracking-[0.18em] text-white"
          >
            ASK GOOGLE
          </button>
        </div>
        <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {EXAMPLES.map((example) => (
            <FilterChip
              key={example.label}
              href={sportResearchAskHref(example.league, example.q)}
              active={query === example.q && league === example.league}
              tone="default"
              prefetch={false}
              className="chip-hit-lg shrink-0"
            >
              {example.label}
            </FilterChip>
          ))}
        </div>
        {!googleConfigured ? (
          <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-[#f3c14b]/80">
            GOOGLE SEARCH NOT CONFIGURED  ·  set GOOGLE_API_KEY and GOOGLE_CSE_ID
            (or GOOGLE_SEARCH_ENGINE_ID). This feed will not invent sources.
          </p>
        ) : (
          <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-white/40">
            Google Programmable Search  ·  snippets only  ·  demo false
          </p>
        )}
      </form>

      {query && ask ? <AskAnswer data={ask} /> : null}

      <div className="mt-4 border border-white/10 bg-[#111] px-3 py-3 sm:px-4">
        <p className="font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
          {missingRequested ? "NO BRIEF ON THIS FEED YET" : liveFeed.honesty.headline}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/55">
          {missingRequested
            ? "That id is not on disk. Anomalies and WPA are never invented to fill a missing brief."
            : liveFeed.honesty.detail}
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
      ) : (
        <div className="mt-6">
          <BriefList feed={liveFeed} league={league} />
        </div>
      )}
    </div>
  );
}
