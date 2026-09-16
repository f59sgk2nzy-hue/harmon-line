"use client";

import { TeamLogo } from "@/components/team-logo";
import { gameHref } from "@/lib/board-url";
import { formatKickoff } from "@/lib/dates";
import { deepDiveHref } from "@/lib/espn-stats";
import { teamHref } from "@/lib/espn-team";
import { DEFAULT_LEAGUE, getLeague } from "@/lib/leagues";
import type { GameSummary, LeagueId, TeamSide } from "@/lib/types";
import Link from "next/link";
import { ViewTransition } from "react";

function TeamRow({
  team,
  possess,
  emphasize,
  gameHref: scoreHref,
  league,
}: {
  team: TeamSide;
  possess: boolean;
  emphasize: boolean;
  gameHref: string;
  league: LeagueId;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <Link
        href={teamHref(team.id, league)}
        transitionTypes={["nav-forward"]}
        className="pressable tap-row grid min-h-12 min-w-0 grid-cols-[28px_1fr] items-center gap-2 px-1 no-underline sm:grid-cols-[34px_1fr]"
      >
        <ViewTransition name={`team-logo-${team.id}`} share="morph" default="none">
          <span className="inline-flex">
            <TeamLogo
              src={team.logo}
              alt=""
              abbreviation={team.abbreviation}
              color={team.color}
              size={28}
            />
          </span>
        </ViewTransition>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-display text-[16px] leading-none tracking-wide text-white sm:text-[19px]">
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
          <p className="mt-1 truncate font-mono text-[10px] text-white/45">
            {team.abbreviation}
            {team.record ? `  ${team.record}` : ""}
            {team.conferenceName ? `  ·  ${team.conferenceName}` : ""}
          </p>
        </div>
      </Link>
      <Link
        href={scoreHref}
        transitionTypes={["nav-forward"]}
        className={`pressable tap-row inline-flex min-h-12 min-w-14 items-center justify-end px-2 text-right font-display text-[30px] leading-none tracking-tight no-underline sm:text-[36px] ${
          emphasize ? "text-white" : "text-white/50"
        }`}
      >
        {team.score ?? "–"}
      </Link>
    </div>
  );
}

export function GameCard({
  game,
  league = DEFAULT_LEAGUE,
}: {
  game: GameSummary;
  league?: LeagueId;
}) {
  const spec = getLeague(league);
  const live = game.status.state === "in";
  const final = game.status.state === "post";
  const football = spec.detailModules.footballSituation;
  const showDeepDive = league === "cfb";
  const awayHasBall = football && game.situation?.possessionTeamId === game.away.id;
  const homeHasBall = football && game.situation?.possessionTeamId === game.home.id;
  const awayLead =
    game.away.score != null && game.home.score != null && game.away.score > game.home.score;
  const homeLead =
    game.away.score != null && game.home.score != null && game.home.score > game.away.score;
  const href = gameHref(game.id, league);

  return (
    <article className={`score-cell outline-none ${live ? "is-live" : ""}`}>
      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        className="pressable flex min-h-10 items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5 no-underline"
      >
        <div className="flex items-center gap-2">
          {live ? (
            <span className="live-pill font-display text-[10px] tracking-[0.2em]">
              <span className="live-dot" />
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

      <div className="space-y-1 px-2 py-2.5 sm:px-3">
        <TeamRow
          team={game.away}
          possess={Boolean(live && awayHasBall)}
          emphasize={!final || awayLead || (!awayLead && !homeLead)}
          gameHref={href}
          league={league}
        />
        <TeamRow
          team={game.home}
          possess={Boolean(live && homeHasBall)}
          emphasize={!final || homeLead || (!awayLead && !homeLead)}
          gameHref={href}
          league={league}
        />
      </div>

      <div className="flex items-start justify-between gap-2 border-t border-white/8 px-3 py-2">
        <Link
          href={href}
          transitionTypes={["nav-forward"]}
          className="pressable min-w-0 flex-1 truncate font-mono text-[10px] leading-relaxed text-white/55 no-underline"
        >
          {football && live && game.situation?.downDistanceText
            ? `${game.situation.downDistanceText}${
                game.situation.isRedZone ? "  ·  RED ZONE" : ""
              }`
            : football && live && game.situation?.lastPlay
              ? game.situation.lastPlay
              : [game.venue, game.broadcast].filter(Boolean).join("  · ") || "Tap for game detail"}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {showDeepDive ? (
            <Link
              href={deepDiveHref(game.id)}
              className="inline-flex min-h-11 items-center font-display text-[10px] tracking-[0.16em] text-[#f3c14b] no-underline"
            >
              SIM
            </Link>
          ) : null}
          <Link
            href={href}
            className="inline-flex min-h-8 items-center font-display text-[10px] tracking-[0.16em] text-white/35 no-underline"
          >
            {game.playByPlayAvailable ? "PBP" : "SCORES"}
          </Link>
        </div>
      </div>
    </article>
  );
}
