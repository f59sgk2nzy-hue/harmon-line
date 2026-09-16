import { DisclaimerFooter, DisclaimerModal } from "@/components/disclaimer-modal";
import { EmptyState } from "@/components/empty-state";
import { sportBoardHref, sportOracleHref } from "@/lib/board-url";
import { formatPollClock } from "@/lib/dates";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { LeagueId, OracleResponse } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const SUGGESTIONS = [
  "What's the score?",
  "Who won?",
  "What's the record and rank?",
  "Who is better on paper?",
];

function suggestionHref(
  q: string,
  league: LeagueId,
  gameId: string | null,
  teamId: string | null
): string {
  return sportOracleHref(league, { gameId, teamId, q });
}

export function OracleView({
  league = DEFAULT_LEAGUE,
  gameId = null,
  teamId = null,
  question = "",
  result = null,
  error = null,
}: {
  league?: LeagueId;
  gameId?: string | null;
  teamId?: string | null;
  question?: string;
  result?: OracleResponse | null;
  error?: string | null;
}) {
  const spec = getLeague(league);
  const stamp = result ? formatPollClock(result.generatedAt) : "";
  const grounded =
    result?.grounded.gameId || result?.grounded.teamId
      ? [
          result.grounded.gameId ? `GAME ${result.grounded.gameId}` : null,
          result.grounded.teamId ? `TEAM ${result.grounded.teamId}` : null,
        ]
          .filter(Boolean)
          .join("  ·  ")
      : gameId || teamId
        ? [gameId ? `GAME ${gameId}` : null, teamId ? `TEAM ${teamId}` : null]
            .filter(Boolean)
            .join("  ·  ")
        : "NO GAME/TEAM ID  ·  MATCH FROM QUESTION";

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
          {spec.shortLabel}  ·  STAT ORACLE  ·  {stamp || "ESPN PUBLIC FEED"}
        </p>
      </div>

      <section className="score-cell overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <p className="font-display text-xs tracking-[0.2em] text-[#ff3b3b]">
            SITUATIONAL Q&A  ·  NO INVENTED STATS
          </p>
          <span className="inline-flex min-h-7 items-center rounded-sm bg-[#cc0000] px-2.5 font-display text-[11px] tracking-[0.2em] text-white">
            DEMO FALSE
          </span>
        </div>
        <form action="/oracle" method="get" className="px-3 py-3 sm:px-4">
          {league !== DEFAULT_LEAGUE ? (
            <input type="hidden" name="league" value={league} />
          ) : null}
          {gameId ? <input type="hidden" name="gameId" value={gameId} /> : null}
          {teamId ? <input type="hidden" name="teamId" value={teamId} /> : null}
          <label htmlFor="oracle-q" className="font-display text-[10px] tracking-[0.18em] text-[#f3c14b]">
            ASK THE BOARD
          </label>
          <textarea
            id="oracle-q"
            name="q"
            required
            maxLength={400}
            defaultValue={question}
            rows={3}
            placeholder="What's the score? Who's ranked higher? What's the down and distance?"
            className="mt-2 w-full resize-y rounded-sm border border-white/15 bg-[#0b0b0b] px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-[#cc0000] focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-sm bg-[#cc0000] px-4 font-display text-[11px] tracking-[0.18em] text-white"
            >
              ASK
            </button>
            <p className="font-mono text-[10px] tracking-[0.12em] text-white/45">{grounded}</p>
          </div>
        </form>
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2 pb-3 sm:px-4">
          {SUGGESTIONS.map((q) => (
            <Link
              key={q}
              href={suggestionHref(q, league, gameId, teamId)}
              className="pressable chip-hit chip-idle shrink-0 border border-white/15 no-underline"
            >
              {q.toUpperCase()}
            </Link>
          ))}
        </div>
      </section>

      {error ? (
        <p className="mt-4 border border-[#cc0000] bg-[#2a0000] px-3 py-2 font-mono text-xs text-[#ffb3b3]">
          {error}. Scores are never invented.
        </p>
      ) : null}

      {result?.disclaimer && result.disclaimerLong ? (
        <div className="mt-4">
          <DisclaimerModal shortText={result.disclaimer} longText={result.disclaimerLong} />
        </div>
      ) : null}

      {!question && !result ? (
        <EmptyState
          className="mt-4"
          kicker="STAT ORACLE LITE V0"
          headline="ASK A SITUATIONAL QUESTION"
          detail="Answers come from public ESPN summary, scoreboard, and rankings JSON already on The Harmon Line. Optional CFBD fills blank college-football season-stat cells when CFBD_API_KEY is set. Missing numbers stay empty."
        />
      ) : null}

      {result ? (
        <>
          <section className="mt-4 border border-white/10 bg-[#111]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">
                {result.empty ? "NOT ON THIS FEED" : "ANSWER"}
              </h2>
              <p className="font-mono text-[10px] text-white/40">
                {result.source.toUpperCase()}  ·  {result.modelVersion}
              </p>
            </div>
            <div className="px-3 py-3 sm:px-4">
              <p className="font-display text-2xl tracking-[0.08em] text-white sm:text-3xl">
                {result.answer.headline}
              </p>
              <p className="mt-2 font-mono text-[13px] leading-relaxed text-white/75">
                {result.answer.summary}
              </p>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/40">
                {result.honesty.detail}
              </p>
            </div>
          </section>

          <section className="mt-4 grid gap-3 md:grid-cols-2">
            <div data-evidence-panel className="border border-[#8ee08e]/25 bg-[#0d1a0d]">
              <h3 className="border-b border-[#8ee08e]/20 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#8ee08e]">
                EVIDENCE  ·  OBSERVED
              </h3>
              {result.evidence.length === 0 ? (
                <p className="px-3 py-3 font-mono text-[11px] text-white/55">No observed cells on this feed.</p>
              ) : (
                <ul className="space-y-2 px-3 py-3 font-mono text-[11px] leading-relaxed text-white/75">
                  {result.evidence.map((row) => (
                    <li key={row.text}>{row.text}</li>
                  ))}
                </ul>
              )}
            </div>
            <div data-inference-panel className="border border-[#f3c14b]/25 bg-[#16120a]">
              <h3 className="border-b border-[#f3c14b]/20 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
                INFERENCE  ·  MODEL
              </h3>
              {result.inference.length === 0 ? (
                <p className="px-3 py-3 font-mono text-[11px] text-white/55">
                  No model narrative. Factual asks stay in Evidence.
                </p>
              ) : (
                <ul className="space-y-2 px-3 py-3 font-mono text-[11px] leading-relaxed text-white/75">
                  {result.inference.map((row) => (
                    <li key={row.text} className="flex flex-col gap-1">
                      <span
                        data-inference-badge
                        className="inline-flex w-fit min-h-6 items-center rounded-sm bg-[#cc0000] px-2 font-display text-[10px] tracking-[0.16em] text-white"
                      >
                        {row.badge}
                      </span>
                      {row.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {result.disclaimer ? <DisclaimerFooter text={result.disclaimer} /> : null}
        </>
      ) : null}
    </div>
  );
}
