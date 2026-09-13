import { DisclaimerFooter, DisclaimerModal } from "@/components/disclaimer-modal";
import { TeamLogo } from "@/components/team-logo";
import { formatKickoff, formatPollClock } from "@/lib/dates";
import { deepDiveHref } from "@/lib/espn-stats";
import { teamHref } from "@/lib/espn-team";
import { formatWinPct } from "@/lib/sim";
import type {
  DeepDiveResponse,
  HarmonLinePropCard,
  PropConfidence,
  TeamSeasonStats,
  TeamSide,
} from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function confidenceTone(level: PropConfidence): string {
  if (level === "HIGH") return "bg-[#0d3d0d] text-[#8ee08e]";
  if (level === "MEDIUM") return "bg-[#3d350d] text-[#f3c14b]";
  return "bg-white/10 text-white/65";
}

function statCell(value: number | null, suffix = ""): string {
  if (value == null) return "—";
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded}${suffix}`;
}

const STAT_ROWS: Array<{ key: keyof TeamSeasonStats; label: string; suffix?: string }> = [
  { key: "pointsPerGame", label: "Points / G" },
  { key: "pointsAllowedPerGame", label: "Points allowed / G" },
  { key: "rushingYardsPerGame", label: "Rush Y / G" },
  { key: "passingYardsPerGame", label: "Pass Y / G" },
  { key: "yardsPerRush", label: "Yards / rush" },
  { key: "yardsPerPass", label: "Yards / pass" },
  { key: "completionPct", label: "Completion %", suffix: "%" },
  { key: "thirdDownPct", label: "3rd down %", suffix: "%" },
  { key: "rushingTouchdowns", label: "Rush TDs" },
  { key: "turnoverDifferential", label: "TO differential" },
  { key: "sacks", label: "Sacks" },
  { key: "gamesPlayed", label: "Games played" },
];


function TeamMini({ team }: { team: TeamSide }) {
  return (
    <Link href={teamHref(team.id)} className="flex min-h-11 min-w-0 items-center gap-2 no-underline">
      <TeamLogo src={team.logo} alt="" abbreviation={team.abbreviation} color={team.color} size={36} />
      <span className="truncate font-display text-sm tracking-wide text-white sm:text-lg">
        {team.rank ? <span className="mr-1 text-[#f3c14b]">{team.rank}</span> : null}
        {team.shortName.toUpperCase()}
      </span>
    </Link>
  );
}

function PropCard({ card }: { card: HarmonLinePropCard }) {
  return (
    <article data-prop-card className="border border-white/10 bg-[#111] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[10px] tracking-[0.18em] text-white/40">
          {card.market}  ·  {card.title.toUpperCase()}
        </p>
        <span
          className={`inline-flex min-h-6 items-center px-2 font-display text-[10px] tracking-[0.14em] ${confidenceTone(card.confidence)}`}
        >
          {card.confidence}
        </span>
      </div>
      <p className="mt-2 font-display text-lg leading-tight tracking-wide text-white">{card.lean}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div data-evidence>
          <p className="font-display text-[10px] tracking-[0.16em] text-[#8ee08e]">EVIDENCE</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 font-mono text-[11px] text-white/60">
            {card.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div data-inference>
          <p className="font-display text-[10px] tracking-[0.16em] text-[#f3c14b]">INFERENCE</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 font-mono text-[11px] text-white/60">
            {card.inference.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/45">{card.why}</p>
      <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-white/35">
        {card.oddsAvailable
          ? `${card.oddsAvailable.provider.toUpperCase()}  ·  ${card.oddsAvailable.line}  ·  ESPN PICKCENTER  ·  EDGE VS MARKET NULL`
          : "NO LIVE ODDS  ·  EDGE_VS_MARKET NULL  ·  CARD STRUCTURED FOR A LATER ODDS FEED"}
      </p>
    </article>
  );
}

export function DeepDiveView({
  data,
  error,
}: {
  data: DeepDiveResponse | null;
  error?: string | null;
}) {
  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 pb-16">
        <Link href="/" className="font-display text-xs tracking-[0.16em] text-white/60">
          ← BACK TO THE BOARD
        </Link>
        <p className="mt-6 font-display text-2xl tracking-[0.12em] text-white">
          {error ?? "Deep Dive unavailable"}
        </p>
        <p className="mt-2 font-mono text-xs text-white/50">
          Live scores are never invented. If ESPN dropped this event, the sim stays empty.
        </p>
      </div>
    );
  }

  const {
    game,
    homeStats,
    awayStats,
    simulation,
    analysis,
    props,
    coverage,
    market,
    disclaimer,
    disclaimerLong,
    evidence,
    inference,
  } = data;
  const stamp = formatPollClock(data.generatedAt);
  const maxBin = Math.max(...simulation.histogram.map((bin) => bin.count), 1);
  const final = game.status.state === "post";
  const live = game.status.state === "in";

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 pb-20 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/game/${game.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70"
        >
          <ArrowLeft className="size-3.5" />
          GAME
        </Link>
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
          {game.subdivision}  ·  DEEP DIVE  ·  {stamp}
        </p>
      </div>

      <DisclaimerModal shortText={disclaimer} longText={disclaimerLong} />

      <section className="score-cell mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <p className="font-display text-xs tracking-[0.2em] text-[#ff3b3b]">
            {live ? "LIVE GAME  ·  MODEL IS NOT THE LIVE SCORE" : final ? "FINAL  ·  MODEL ≠ RESULT" : formatKickoff(game.date)}
          </p>
          <span
            data-sim-label
            className="rounded-sm bg-[#cc0000] px-2 py-0.5 font-display text-[10px] tracking-[0.2em] text-white"
          >
            SIMULATION
          </span>
        </div>
        <div className="grid gap-4 px-3 py-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-4">
          <TeamMini team={game.away} />
          <div className="text-center">
            <p className="font-display text-[10px] tracking-[0.18em] text-[#f3c14b]">
              EXPECTED SCORE
            </p>
            <p className="mt-1 font-display text-3xl leading-none text-white sm:text-4xl">
              {Math.round(simulation.expectedAwayScore)}
              <span className="mx-1 text-white/35">–</span>
              {Math.round(simulation.expectedHomeScore)}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/45">
              {game.away.abbreviation} – {game.home.abbreviation}  ·  NOT A LOCK
            </p>
          </div>
          <div className="sm:justify-self-end">
            <TeamMini team={game.home} />
          </div>
        </div>
        {final || live ? (
          <p className="border-t border-white/10 px-3 py-2 font-mono text-[11px] text-white/55 sm:px-4">
            Published ESPN {live ? "live" : "final"}: {game.away.abbreviation} {game.away.score ?? "—"}{" "}
            · {game.home.abbreviation} {game.home.score ?? "—"}. The numbers above are the model, not a
            replacement score.
          </p>
        ) : null}
      </section>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <a
          href="#matchup"
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm bg-[#cc0000] px-3 font-display text-[10px] tracking-[0.16em] text-white no-underline"
        >
          MATCHUP
        </a>
        <a
          href="#simulation"
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-white/15 px-3 font-display text-[10px] tracking-[0.16em] text-white/80 no-underline"
        >
          SIM
        </a>
        <a
          href="#props"
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-white/15 px-3 font-display text-[10px] tracking-[0.16em] text-white/80 no-underline"
        >
          PROPS
        </a>
      </nav>

      <section id="matchup" className="mt-4 border border-white/10 bg-[#111]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">
            EVIDENCE  ·  MATCHUP STATS
          </h2>
          <p className="font-mono text-[10px] text-white/40">{coverage.stats.headline}</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 border-b border-white/8 px-3 py-2 font-display text-[10px] tracking-[0.14em] text-white/40">
          <span>{game.away.abbreviation}</span>
          <span className="text-center">ESPN</span>
          <span className="text-right">{game.home.abbreviation}</span>
        </div>
        {STAT_ROWS.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_auto_1fr] gap-2 border-b border-white/5 px-3 py-2 font-mono text-[12px]"
          >
            <span className="text-white">{statCell(awayStats[row.key] as number | null, row.suffix)}</span>
            <span className="text-center text-[10px] tracking-[0.12em] text-white/40">{row.label}</span>
            <span className="text-right text-white">
              {statCell(homeStats[row.key] as number | null, row.suffix)}
            </span>
          </div>
        ))}
        {!homeStats.available && !awayStats.available ? (
          <p className="px-3 py-4 font-mono text-[11px] leading-relaxed text-white/55">
            {coverage.stats.detail}
          </p>
        ) : null}
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <div data-evidence-panel className="border border-[#8ee08e]/25 bg-[#0d1a0d]">
          <h3 className="border-b border-[#8ee08e]/20 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#8ee08e]">
            EVIDENCE  ·  OBSERVED
          </h3>
          <ul className="space-y-2 px-3 py-3 font-mono text-[11px] leading-relaxed text-white/75">
            {evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div data-inference-panel className="border border-[#f3c14b]/25 bg-[#16120a]">
          <h3 className="border-b border-[#f3c14b]/20 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
            INFERENCE  ·  MODEL
          </h3>
          <ul className="space-y-2 px-3 py-3 font-mono text-[11px] leading-relaxed text-white/75">
            {inference.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-4 border border-[#f3c14b]/25 bg-[#16120a]">
        <h2 className="border-b border-[#f3c14b]/20 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
          {analysis.headline}
        </h2>
        <div className="space-y-3 px-3 py-3">
          {analysis.paragraphs.map((paragraph) => (
            <p key={paragraph} className="font-mono text-[12px] leading-relaxed text-white/80">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section id="simulation" data-sim-chart className="mt-4 border border-white/10 bg-[#111]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">
            INFERENCE  ·  SIMULATION  ·  {simulation.trials.toLocaleString()} TRIALS
          </h2>
          <span className={`inline-flex items-center px-2 py-0.5 font-display text-[10px] tracking-[0.16em] ${confidenceTone(simulation.confidence)}`}>
            {simulation.confidence}  ·  NOT A LOCK
          </span>
        </div>
        <div className="px-3 py-4">
          <div className="flex items-end justify-between gap-3 font-display text-sm">
            <p>
              <span className="text-white/50">{game.away.abbreviation}</span>{" "}
              <span className="text-white">{formatWinPct(simulation.awayWinPct)}</span>
            </p>
            <p className="text-[10px] tracking-[0.16em] text-white/40">WIN PROB</p>
            <p className="text-right">
              <span className="text-white">{formatWinPct(simulation.homeWinPct)}</span>{" "}
              <span className="text-white/50">{game.home.abbreviation}</span>
            </p>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden bg-black/50">
            <div
              className="bg-white/40"
              style={{ width: `${Math.max(simulation.awayWinPct * 100, 1)}%` }}
            />
            <div
              className="bg-[#cc0000]"
              style={{ width: `${Math.max(simulation.homeWinPct * 100, 1)}%` }}
            />
          </div>
          <p className="mt-4 font-mono text-[11px] text-white/70">
            Predicted margin (home): {simulation.marginLow > 0 ? "+" : ""}
            {simulation.marginLow} to {simulation.marginHigh > 0 ? "+" : ""}
            {simulation.marginHigh}  ·  mean {simulation.meanMargin > 0 ? "+" : ""}
            {simulation.meanMargin}  ·  total {simulation.totalLow}–{simulation.totalHigh} (mean{" "}
            {simulation.meanTotal})
          </p>
          <div className="mt-4 flex h-28 items-end gap-px sm:gap-0.5">
            {simulation.histogram.map((bin) => (
              <div
                key={`${bin.start}-${bin.end}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
                title={`${bin.start} to ${bin.end}: ${Math.round(bin.pct * 100)}%`}
              >
                <div
                  className={`w-full min-h-[2px] ${bin.start >= 0 ? "bg-[#cc0000]" : "bg-white/35"}`}
                  style={{ height: `${Math.max((bin.count / maxBin) * 100, 3)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-white/35">
            <span>away blowout</span>
            <span>0</span>
            <span>home blowout</span>
          </div>
          <details className="mt-4 border border-white/8 bg-black/30 px-3 py-2">
            <summary className="cursor-pointer font-display text-[10px] tracking-[0.16em] text-white/55">
              MODEL ASSUMPTIONS
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 font-mono text-[11px] text-white/60">
              {simulation.assumptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {simulation.inputsMissing.length > 0 ? (
                <li>Missing inputs: {simulation.inputsMissing.join("; ")}.</li>
              ) : null}
            </ul>
          </details>
        </div>
      </section>

      <section id="props" className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">PROP FEEDBACK</h2>
          <p className="font-mono text-[10px] text-white/40">
            {coverage.market.headline}  ·  {coverage.cfbd.headline}
          </p>
        </div>
        {market ? (
          <p className="mb-3 font-mono text-[11px] text-white/55">
            ESPN pickcenter: {market.details ?? "—"}
            {market.overUnder != null ? `  ·  O/U ${market.overUnder}` : ""}  ·  {market.provider}
          </p>
        ) : (
          <p className="mb-3 font-mono text-[11px] text-white/45">{coverage.market.detail}</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {props.map((card) => (
            <PropCard key={card.id} card={card} />
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-white/40">{coverage.players.detail}</p>
      </section>

      <div className="mt-6">
        <DisclaimerModal shortText={disclaimer} longText={disclaimerLong} />
      </div>
      <DisclaimerFooter text={disclaimer} />
    </div>
  );
}

export { deepDiveHref };
