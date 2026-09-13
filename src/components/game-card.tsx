"use client";

import { formatKickoff } from "@/lib/dates";
import { deepDiveHref } from "@/lib/espn-stats";
import { teamHref } from "@/lib/espn-team";
import type { GameSummary, TeamSide } from "@/lib/types";
import { TeamLogo } from "@/components/team-logo";
import Link from "next/link";

function TeamRow({
  team,
  possess,
  emphasize,
  gameHref,
}: {
  team: TeamSide;
  possess: boolean;
  emphasize: boolean;
  gameHref: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <Link
        href={teamHref(team.id)}
        className="grid min-h-11 min-w-0 grid-cols-[28px_1fr] items-center gap-2 no-underline sm:grid-cols-[34px_1fr]"
      >
        <TeamLogo
          src={team.logo}
          alt=""
          abbreviation={team.abbreviation}
          color={team.color}
          size={28}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-display text-[15px] leading-none tracking-wide text-white sm:text-lg">
            {team.rank ? (
              <span className="text-[11px] text-[#f3c14b]">{team.rank}</span>
            ) : null}
            <span className="truncate">{team.shortName.toUpperCase()}</span>
            {possess ? (
              <span className="text-[10px] text-[#f3c14b]" title="Possession">
                ●
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-white/45">
            {team.abbreviation}
            {team.record ? `  ${team.record}` : ""}
            {team.conferenceName ? `  ·  ${team.conferenceName}` : ""}
          </p>
        </div>
      </Link>
      <Link
        href={gameHref}
        className={`min-h-11 px-1 text-right font-display text-[28px] leading-none tracking-tight no-underline sm:text-[34px] ${
          emphasize ? "text-white" : "text-white/55"
        }`}
      >
        {team.score ?? "–"}
      </Link>
    </div>
  );
}

export function GameCard({ game }: { game: GameSummary }) {
  const live = game.status.state === "in";
  const final = game.status.state === "post";
  const awayHasBall = game.situation?.possessionTeamId === game.away.id;
  const homeHasBall = game.situation?.possessionTeamId === game.home.id;
  const awayLead =
    game.away.score != null && game.home.score != null && game.away.score > game.home.score;
  const homeLead =
    game.away.score != null && game.home.score != null && game.home.score > game.away.score;
  const gameHref = `/game/${game.id}`;

  return (
    <article className="score-cell outline-none">
      <Link
        href={gameHref}
        className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5 no-underline"
      >
        <div className="flex items-center gap-2">
          {live ? (
            <span className="live-dot font-display text-[10px] tracking-[0.2em] text-[#ff3b3b]">
              LIVE
            </span>
          ) : final ? (
            <span className="font-display text-[10px] tracking-[0.18em] text-white/70">
              FINAL
            </span>
          ) : (
            <span className="font-display text-[10px] tracking-[0.14em] text-[#f3c14b]">
              {formatKickoff(game.date)}
            </span>
          )}
          <span className="font-mono text-[10px] text-white/40">{game.subdivision}</span>
        </div>
        <span className="font-mono text-[10px] text-white/55">
          {live || final ? game.status.shortDetail : (game.broadcast ?? "TBD")}
        </span>
      </Link>

      <div className="space-y-2.5 px-3 py-3">
        <TeamRow
          team={game.away}
          possess={Boolean(live && awayHasBall)}
          emphasize={!final || awayLead || (!awayLead && !homeLead)}
          gameHref={gameHref}
        />
        <TeamRow
          team={game.home}
          possess={Boolean(live && homeHasBall)}
          emphasize={!final || homeLead || (!awayLead && !homeLead)}
          gameHref={gameHref}
        />
      </div>

      <div className="flex items-start justify-between gap-2 border-t border-white/8 px-3 py-2">
        <Link
          href={gameHref}
          className="min-w-0 flex-1 truncate font-mono text-[10px] leading-relaxed text-white/55 no-underline"
        >
          {live && game.situation?.downDistanceText
            ? `${game.situation.downDistanceText}${
                game.situation.isRedZone ? "  ·  RED ZONE" : ""
              }`
            : live && game.situation?.lastPlay
              ? game.situation.lastPlay
              : [game.venue, game.broadcast].filter(Boolean).join("  · ") || "Tap for game detail"}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={deepDiveHref(game.id)}
            className="inline-flex min-h-11 items-center font-display text-[10px] tracking-[0.16em] text-[#f3c14b] no-underline"
          >
            SIM
          </Link>
          <Link
            href={gameHref}
            className="inline-flex min-h-8 items-center font-display text-[10px] tracking-[0.16em] text-white/35 no-underline"
          >
            {game.playByPlayAvailable ? "PBP" : "SCORES"}
          </Link>
        </div>
      </div>
    </article>
  );
}
