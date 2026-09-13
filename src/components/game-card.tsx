"use client";

import { TeamLink } from "@/components/team-link";
import { TeamLogo } from "@/components/team-logo";
import { formatKickoff } from "@/lib/dates";
import type { GameSummary, TeamSide } from "@/lib/types";
import Link from "next/link";

function TeamRow({
  team,
  possess,
  emphasize,
}: {
  team: TeamSide;
  possess: boolean;
  emphasize: boolean;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 sm:grid-cols-[34px_1fr_auto]">
      <TeamLink teamId={team.id} className="justify-center" title={team.name}>
        <TeamLogo
          src={team.logo}
          alt=""
          abbreviation={team.abbreviation}
          color={team.color}
          size={28}
        />
      </TeamLink>
      <div className="min-w-0">
        <TeamLink teamId={team.id} className="w-full" title={`${team.name} team page`}>
          <p className="flex min-w-0 items-center gap-1.5 font-display text-[15px] leading-none tracking-wide sm:text-lg">
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
        </TeamLink>
        <p className="mt-0.5 truncate font-mono text-[10px] text-white/45">
          {team.abbreviation}
          {team.record ? `  ${team.record}` : ""}
          {team.conferenceName ? `  ·  ${team.conferenceName}` : ""}
        </p>
      </div>
      <p
        className={`font-display text-[28px] leading-none tracking-tight sm:text-[34px] ${
          emphasize ? "text-white" : "text-white/55"
        }`}
      >
        {team.score ?? "–"}
      </p>
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

  return (
    <article className="score-cell group">
      <Link
        href={`/game/${game.id}`}
        className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]"
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

      <div className="space-y-1 px-3 py-2">
        <TeamRow
          team={game.away}
          possess={Boolean(live && awayHasBall)}
          emphasize={!final || awayLead || (!awayLead && !homeLead)}
        />
        <TeamRow
          team={game.home}
          possess={Boolean(live && homeHasBall)}
          emphasize={!final || homeLead || (!awayLead && !homeLead)}
        />
      </div>

      <Link
        href={`/game/${game.id}`}
        className="flex items-start justify-between gap-2 border-t border-white/8 px-3 py-2 no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]"
      >
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] leading-relaxed text-white/55">
          {live && game.situation?.downDistanceText
            ? `${game.situation.downDistanceText}${
                game.situation.isRedZone ? "  ·  RED ZONE" : ""
              }`
            : live && game.situation?.lastPlay
              ? game.situation.lastPlay
              : [game.venue, game.broadcast].filter(Boolean).join("  · ") || "Tap name for team · tap here for game"}
        </p>
        <span className="shrink-0 font-display text-[10px] tracking-[0.16em] text-white/35 group-hover:text-[#ff3b3b]">
          {game.playByPlayAvailable ? "PBP" : "SCORES"}
        </span>
      </Link>
    </article>
  );
}