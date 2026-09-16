import { DisclaimerFooter, DisclaimerModal } from "@/components/disclaimer-modal";
import { EmptyState } from "@/components/empty-state";
import { FilterChip } from "@/components/filter-chip";
import { sportBoardHref, sportOracleHref } from "@/lib/board-url";
import { getLeague } from "@/lib/leagues";
import type { OracleResponse } from "@/lib/oracle";
import type { LeagueId } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const EXAMPLES: Array<{ q: string; league: LeagueId; label: string }> = [
  { q: "Ohio State vs Texas score", league: "cfb", label: "OSU vs TEX" },
  { q: "Where is Alabama ranked?", league: "cfb", label: "BAMA RANK" },
  { q: "Lakers vs Celtics score", league: "nba", label: "LAL vs BOS" },
  { q: "Chiefs record this week", league: "nfl", label: "CHIEFS" },
];

function LineList({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) {
    return <p className="mt-1 font-mono text-[11px] text-white/50">{empty}</p>;
  }
  return (
    <ul className="mt-1 list-disc space-y-1 pl-4 font-mono text-[11px] text-white/70">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function OracleView({
  league,
  query,
  data,
}: {
  league: LeagueId;
  query: string;
  data: OracleResponse | null;
}) {
  const spec = getLeague(league);
  const showDisclaimer = Boolean(data?.rgDisclaimer);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 pb-20 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={sportBoardHref(league)}
          transitionTypes={["nav-back"]}
          className="inline-flex min-h-11 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70 no-underline"
        >
          <ArrowLeft className="size-3.5" />
          BOARD
        </Link>
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
          {spec.shortLabel}  ·  STAT ORACLE LITE V0  ·  ESPN PUBLIC JSON
        </p>
      </div>

      <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b]">
        EVIDENCE VS INFERENCE  ·  NEVER INVENT SCORES
      </p>
      <h1 className="mt-1 font-display text-2xl tracking-[0.12em] text-white sm:text-3xl">
        STAT ORACLE
      </h1>
      <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-white/58">
        Ask a named game or team in plain language. Answers come from one public ESPN
        scoreboard or summary slice already used by The Harmon Line — not StatMuse SQL,
        not odds, not video.
      </p>

      <form
        method="get"
        action="/oracle"
        className="mt-4 border border-white/10 bg-[#111] p-3 sm:p-4"
      >
        {league !== "cfb" ? <input type="hidden" name="league" value={league} /> : null}
        <label htmlFor="oracle-q" className="font-display text-[10px] tracking-[0.18em] text-white/45">
          QUESTION
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="oracle-q"
            name="q"
            defaultValue={query}
            placeholder="Ohio State vs Texas score"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-sm border border-white/15 bg-black/40 px-3 font-sans text-sm text-white placeholder:text-white/30"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-[#cc0000] px-4 font-display text-[11px] tracking-[0.18em] text-white"
          >
            ASK ESPN
          </button>
        </div>
        <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {EXAMPLES.map((example) => (
            <FilterChip
              key={example.label}
              href={sportOracleHref(example.league, example.q)}
              active={query === example.q && league === example.league}
              tone="default"
              className="chip-hit-lg shrink-0"
            >
              {example.label}
            </FilterChip>
          ))}
        </div>
      </form>

      {showDisclaimer && data?.rgDisclaimer ? (
        <div className="mt-4">
          <DisclaimerModal shortText={data.rgDisclaimer} longText={data.rgDisclaimer} />
        </div>
      ) : null}

      {!query ? (
        <div className="mt-6">
          <EmptyState
            kicker="STAT ORACLE LITE V0"
            headline="NAME A GAME OR TEAM"
            detail="Try a matchup, a rank question, or a live score. If ESPN did not publish it on this feed, the answer stays empty."
          />
        </div>
      ) : data ? (
        <div className="mt-6 space-y-4">
          <div className="border border-white/10 bg-[#111] px-3 py-3 sm:px-4">
            <p className="font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
              {data.honesty.headline}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/55">
              {data.honesty.detail}
            </p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-white/35">
              {data.league.toUpperCase()}  ·  {data.scope.toUpperCase()}  ·  DEMO {String(data.demo).toUpperCase()}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section data-evidence className="border border-white/10 bg-[#111] p-3 sm:p-4">
              <p className="font-display text-[10px] tracking-[0.16em] text-[#8ee08e]">EVIDENCE</p>
              <LineList lines={data.evidence} empty="No published cells on this ESPN slice." />
            </section>
            <section data-inference className="border border-white/10 bg-[#111] p-3 sm:p-4">
              <p className="font-display text-[10px] tracking-[0.16em] text-[#f3c14b]">INFERENCE</p>
              <LineList
                lines={data.inference}
                empty="No inference. Missing data stays blank — never invented."
              />
            </section>
          </div>

          <article className="border border-white/10 bg-[#0e0e0e] p-3 sm:p-4">
            <p className="font-display text-[10px] tracking-[0.16em] text-white/40">ANSWER</p>
            <div className="mt-2 space-y-2 font-sans text-sm leading-relaxed whitespace-pre-wrap text-white/80">
              {data.answerMarkdown}
            </div>
          </article>

          {data.sources.length > 0 ? (
            <p className="font-mono text-[10px] tracking-[0.12em] text-white/40">
              SOURCES  ·  {data.sources.map((src) => src.label).join("  ·  ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {data?.rgDisclaimer ? <DisclaimerFooter text={data.rgDisclaimer} /> : null}
    </div>
  );
}
