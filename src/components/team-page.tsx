import { EmptyState } from "@/components/empty-state";
import { TeamLogo } from "@/components/team-logo";
import { formatBoardDate, isoToEspnDate } from "@/lib/dates";
import { teamHref } from "@/lib/espn-team";
import type { TeamPageResponse, TeamScheduleGame } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";

function resultTone(result: TeamScheduleGame["result"]): string {
  if (result === "W") return "bg-[#0d3d0d] text-[#8ee08e]";
  if (result === "L") return "bg-[#3d0d0d] text-[#ffb3b3]";
  if (result === "T") return "bg-[#3d350d] text-[#f3c14b]";
  return "bg-white/10 text-white/55";
}

function ScheduleRow({ game }: { game: TeamScheduleGame }) {
  const dateLabel = game.date
    ? formatBoardDate(isoToEspnDate(game.date.slice(0, 10)))
    : "";
  const at = game.homeAway === "away" ? "@" : "vs";
  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-2 px-2 py-1 sm:grid-cols-[40px_1fr_auto] sm:px-3">
      <span
        className={`inline-flex size-8 items-center justify-center rounded-sm font-display text-xs tracking-[0.08em] ${resultTone(game.result)}`}
      >
        {game.result ?? (game.state === "in" ? "IN" : at)}
      </span>
      <div className="min-w-0">
        <Link
          href={teamHref(game.opponent.id)}
          transitionTypes={["nav-forward"]}
          className="pressable tap-row flex items-center gap-2 px-1 no-underline"
        >
          <ViewTransition name={`team-logo-${game.opponent.id}`} share="morph" default="none">
            <span className="inline-flex">
              <TeamLogo
                src={game.opponent.logo}
                alt=""
                abbreviation={game.opponent.abbreviation}
                size={22}
              />
            </span>
          </ViewTransition>
          <span className="truncate font-display text-sm tracking-wide text-white sm:text-base">
            {at} {game.opponent.name.toUpperCase()}
          </span>
        </Link>
        <p className="mt-0.5 truncate px-1 font-mono text-[10px] text-white/45">
          {game.state === "pre" ? game.shortDetail : dateLabel}
          {game.broadcast ? `  ·  ${game.broadcast}` : ""}
          {game.venue ? `  ·  ${game.venue}` : ""}
        </p>
      </div>
      <Link
        href={`/game/${game.id}`}
        transitionTypes={["nav-forward"]}
        className="pressable tap-row inline-flex min-h-12 min-w-16 items-center justify-end px-2 text-right font-display text-lg leading-none text-white no-underline sm:text-xl"
      >
        {game.teamScore != null && game.opponentScore != null
          ? `${game.teamScore}–${game.opponentScore}`
          : "—"}
      </Link>
    </div>
  );
}

export function TeamPageView({
  data,
  error,
}: {
  data: TeamPageResponse | null;
  error?: string | null;
}) {
  if (!data) {
    return (
      <div className="page-enter mx-auto max-w-5xl px-4 py-10 pb-16">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="pressable font-display text-xs tracking-[0.16em] text-white/60"
        >
          ← BACK TO THE BOARD
        </Link>
        <EmptyState
          className="mt-6"
          kicker="ESPN TEAM FEED"
          headline={error ?? "TEAM UNAVAILABLE"}
          detail="Live scores and rosters are never invented. If ESPN has no page for this school, it stays empty."
        />
      </div>
    );
  }

  const { team, recent, upcoming, roster, coach, coverage } = data;
  const groups = roster.reduce<Record<string, typeof roster>>((acc, player) => {
    const key = player.positionGroup || "Roster";
    acc[key] = acc[key] ? [...acc[key]!, player] : [player];
    return acc;
  }, {});
  const wash = team.color ? `#${team.color.replace("#", "")}` : null;

  return (
    <div className="page-enter mx-auto w-full max-w-5xl px-3 py-4 pb-16 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="pressable inline-flex min-h-10 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70"
        >
          <ArrowLeft className="size-3.5" />
          BOARD
        </Link>
        <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
          {team.subdivision ?? "CFB"}  ·  ESPN TEAM FEED
        </p>
      </div>

      <section
        className="score-cell overflow-hidden"
        style={
          wash
            ? {
                backgroundImage: `linear-gradient(100deg, ${wash}40, transparent 62%)`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <ViewTransition name={`team-logo-${team.id}`} share="morph" default="none">
            <span className="inline-flex">
              <TeamLogo
                src={team.logo}
                alt=""
                abbreviation={team.abbreviation}
                color={team.color}
                size={56}
              />
            </span>
          </ViewTransition>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none tracking-wide text-white sm:text-4xl">
              {team.rank ? <span className="mr-1 text-[#f3c14b]">{team.rank}</span> : null}
              {team.name.toUpperCase()}
            </p>
            <p className="mt-2 font-mono text-[11px] text-white/55">
              {team.abbreviation}
              {team.record ? `  ·  ${team.record}` : ""}
              {team.conferenceName ? `  ·  ${team.conferenceName}` : ""}
              {team.standing ? `  ·  ${team.standing}` : ""}
            </p>
          </div>
        </div>
      </section>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
        <a
          href="#recent"
          className="pressable chip-hit chip-red shrink-0 no-underline"
        >
          RECENT
        </a>
        <a
          href="#upcoming"
          className="pressable chip-hit chip-idle shrink-0 border border-white/15 no-underline"
        >
          SCHEDULE
        </a>
        <a
          href="#roster"
          className="pressable chip-hit chip-idle shrink-0 border border-white/15 no-underline"
        >
          ROSTER
        </a>
      </nav>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section id="recent" className="board-glass">
          <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
            RECENT
          </h2>
          {recent.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              kicker={coverage.schedule.headline}
              headline="NO RECENT GAMES"
              detail={coverage.schedule.detail}
            />
          ) : (
            <div className="divide-y divide-white/5">
              {recent.map((game) => (
                <ScheduleRow key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>

        <section id="upcoming" className="board-glass">
          <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
            UPCOMING
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              kicker={recent.length === 0 ? coverage.schedule.headline : "ESPN SCHEDULE"}
              headline="NO UPCOMING GAMES ON FEED"
              detail={
                recent.length === 0
                  ? coverage.schedule.detail
                  : "ESPN has no remaining scheduled games for this school on the public team endpoint."
              }
            />
          ) : (
            <div className="divide-y divide-white/5">
              {upcoming.map((game) => (
                <ScheduleRow key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section id="roster" className="board-glass mt-4">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="font-display text-xs tracking-[0.18em] text-[#f3c14b]">ROSTER</h2>
          <p className="font-mono text-[10px] text-white/40">
            {coach ? `HC ${coach.toUpperCase()}` : roster.length > 0 ? `${roster.length} PLAYERS` : "ESPN"}
          </p>
        </div>
        {roster.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent shadow-none"
            kicker={coverage.roster.headline}
            headline="ROSTER NOT ON THIS FEED"
            detail={coverage.roster.detail}
          />
        ) : (
          <div>
            {Object.entries(groups).map(([group, players]) => (
              <div key={group}>
                <p className="bg-black/40 px-3 py-1.5 font-display text-[10px] tracking-[0.16em] text-white/45">
                  {group.toUpperCase()}
                </p>
                <ul className="divide-y divide-white/5">
                  {players.map((player) => (
                    <li
                      key={player.id}
                      className="grid min-h-12 grid-cols-[2.25rem_1fr_auto] items-center gap-2 px-3 py-2"
                    >
                      <span className="font-display text-sm text-[#f3c14b]">
                        {player.jersey ? `#${player.jersey}` : "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm tracking-wide text-white">
                          {player.name}
                        </p>
                        <p className="truncate font-mono text-[10px] text-white/45">
                          {[player.position, player.classYear, player.height, player.weight]
                            .filter(Boolean)
                            .join("  ·  ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
