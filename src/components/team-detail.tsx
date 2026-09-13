"use client";

import { TeamLink } from "@/components/team-link";
import { TeamLogo } from "@/components/team-logo";
import { formatKickoff, formatPollClock } from "@/lib/dates";
import { BOARD_REFRESH_MS, useLivePoll } from "@/lib/hooks";
import type { RosterPlayer, TeamDetailResponse, TeamScheduleGame } from "@/lib/types";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

const ROSTER_GROUPS: { id: string; label: string }[] = [
  { id: "offense", label: "OFFENSE" },
  { id: "defense", label: "DEFENSE" },
  { id: "specialTeam", label: "SPECIAL TEAMS" },
];

function resultLabel(game: TeamScheduleGame): string {
  if (game.status.state === "in") return "LIVE";
  if (game.status.state !== "post") return formatKickoff(game.date) || game.status.shortDetail;
  if (game.winner === true) return "W";
  if (game.winner === false) return "L";
  return "FINAL";
}

function scoreLine(game: TeamScheduleGame): string {
  if (game.teamScore == null || game.opponentScore == null) {
    return game.status.state === "post" ? "Score not published" : "—";
  }
  return `${game.teamScore}–${game.opponentScore}`;
}

function versusWord(game: TeamScheduleGame): string {
  if (game.homeAway === "away") return "at";
  if (game.homeAway === "neutral") return "vs";
  return "vs";
}

function ScheduleRow({ game }: { game: TeamScheduleGame }) {
  const live = game.status.state === "in";
  const final = game.status.state === "post";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 border-b border-white/5 last:border-b-0">
      <div className="min-w-0 px-3 py-2">
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/40">
          {game.week ? `WK ${game.week}` : "GAME"}
          {game.venue ? `  ·  ${game.venue}` : ""}
          {game.broadcast ? `  ·  ${game.broadcast}` : ""}
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-white/45">{versusWord(game)}</span>
          <TeamLogo
            src={game.opponent.logo}
            alt=""
            abbreviation={game.opponent.abbreviation}
            size={22}
          />
          <TeamLink teamId={game.opponent.id} className="min-h-11 min-w-0">
            <span className="truncate font-display text-[15px] tracking-wide text-white">
              {game.opponent.shortName.toUpperCase()}
            </span>
          </TeamLink>
        </div>
      </div>
      <Link
        href={`/game/${game.id}`}
        className="flex min-h-11 min-w-[5.5rem] flex-col items-end justify-center px-3 no-underline hover:bg-white/5"
      >
        <span
          className={`font-display text-[11px] tracking-[0.16em] ${
            live ? "text-[#ff3b3b]" : final && game.winner ? "text-[#f3c14b]" : "text-white/55"
          }`}
        >
          {resultLabel(game)}
        </span>
        <span className="font-display text-lg leading-none text-white">{scoreLine(game)}</span>
      </Link>
    </li>
  );
}

function SchedulePanel({
  title,
  games,
  empty,
}: {
  title: string;
  games: TeamScheduleGame[];
  empty: string;
}) {
  return (
    <section className="score-cell overflow-hidden">
      <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
        {title}
      </h2>
      {games.length === 0 ? (
        <p className="px-3 py-6 font-mono text-[11px] leading-relaxed text-white/50">{empty}</p>
      ) : (
        <ol>{games.map((game) => <ScheduleRow key={game.id} game={game} />)}</ol>
      )}
    </section>
  );
}

function RosterGroup({ group, players }: { group: string; players: RosterPlayer[] }) {
  const known = ROSTER_GROUPS.find((item) => item.id === group);
  const label = known?.label ?? group.replace(/([A-Z])/g, " $1").toUpperCase();
  return (
    <div>
      <h3 className="border-b border-white/10 px-3 py-2 font-display text-[11px] tracking-[0.18em] text-white/45">
        {label}
        <span className="ml-2 font-mono text-[10px] tracking-normal">{players.length}</span>
      </h3>
      <ul>
        {players.map((player) => (
          <li
            key={player.id}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0"
          >
            <span className="font-display text-sm text-[#f3c14b]">
              {player.jersey ? `#${player.jersey}` : "—"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[13px] text-white">{player.name}</p>
              <p className="truncate font-mono text-[10px] text-white/40">
                {[player.year, player.hometown].filter(Boolean).join("  ·  ") || "Class / hometown not published"}
              </p>
            </div>
            <span className="font-display text-[11px] tracking-[0.12em] text-white/60">
              {player.position ?? ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamDetailView({
  teamId,
  initial,
  initialError,
}: {
  teamId: string;
  initial: TeamDetailResponse | null;
  initialError?: string | null;
}) {
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState(initialError ?? null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/${teamId}`, { cache: "no-store" });
      const payload = (await response.json()) as TeamDetailResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Team request failed");
      setDetail(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team request failed");
    }
  }, [teamId]);

  useLivePoll(refresh, { intervalMs: BOARD_REFRESH_MS });

  const groupedRoster = useMemo(() => {
    const groups = new Map<string, RosterPlayer[]>();
    for (const player of detail?.roster ?? []) {
      const list = groups.get(player.group) ?? [];
      list.push(player);
      groups.set(player.group, list);
    }
    const order = [...ROSTER_GROUPS.map((item) => item.id), ...[...groups.keys()].filter((id) => !ROSTER_GROUPS.some((item) => item.id === id))];
    return order
      .filter((id) => (groups.get(id)?.length ?? 0) > 0)
      .map((id) => ({ id, players: groups.get(id) ?? [] }));
  }, [detail?.roster]);

  if (!detail) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 pb-16">
        <Link href="/" className="font-display text-xs tracking-[0.16em] text-white/60">
          ← BACK TO THE BOARD
        </Link>
        <p className="mt-6 font-display text-2xl tracking-[0.12em] text-white">
          {error ?? "Loading team…"}
        </p>
        <p className="mt-2 font-mono text-xs text-white/50">
          School pages only show what ESPN publishes. Players and scores are never invented.
        </p>
      </div>
    );
  }

  const { team, recent, upcoming, coach, coverage } = detail;
  const stamp = formatPollClock(detail.generatedAt);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 pb-16 sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          BOARD
        </Link>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-white/40">
            {team.subdivision ?? "CFB"}  ·  POLLED {stamp}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-white/15 px-2 font-display text-[10px] tracking-[0.14em] text-white/70 hover:border-white/40 hover:text-white"
          >
            <RefreshCw className="size-3" />
            REFRESH
          </button>
        </div>
      </div>

      <section className="score-cell overflow-hidden">
        <div
          className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center"
          style={{
            background: team.color
              ? `linear-gradient(90deg, ${team.color}33, transparent 70%)`
              : undefined,
          }}
        >
          <TeamLogo
            src={team.logo}
            alt=""
            abbreviation={team.abbreviation}
            color={team.color}
            size={72}
          />
          <div className="min-w-0">
            <p className="font-display text-[11px] tracking-[0.2em] text-[#f3c14b]">
              {[team.subdivision, team.conferenceName].filter(Boolean).join("  ·  ") || "COLLEGE FOOTBALL"}
            </p>
            <h1 className="mt-1 font-display text-3xl leading-none tracking-wide text-white sm:text-4xl">
              {team.name.toUpperCase()}
            </h1>
            <p className="mt-2 font-mono text-xs text-white/60">
              {team.abbreviation}
              {team.record ? `  ·  ${team.record}` : "  ·  Record not published"}
              {team.standingSummary ? `  ·  ${team.standingSummary}` : ""}
              {coach ? `  ·  HC ${coach.name}` : ""}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-3 border border-[#cc0000] bg-[#2a0000] px-3 py-2 font-mono text-xs text-[#ffb3b3]">
          Refresh error: {error}. Last good ESPN payload is still on screen.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="border-l-4 border-[#cc0000] bg-[#161616] px-3 py-2">
          <p className="font-display text-xs tracking-[0.16em] text-[#f3c14b]">
            {coverage.schedule.headline}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">
            {coverage.schedule.detail}
          </p>
        </div>
        <div className="border-l-4 border-[#cc0000] bg-[#161616] px-3 py-2">
          <p className="font-display text-xs tracking-[0.16em] text-[#f3c14b]">
            {coverage.roster.headline}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">
            {coverage.roster.detail}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SchedulePanel
          title="RECENT RESULTS"
          games={recent}
          empty={`${coverage.schedule.headline}. ${coverage.schedule.detail}`}
        />
        <SchedulePanel
          title="UPCOMING"
          games={upcoming}
          empty={`${coverage.schedule.headline}. ${coverage.schedule.detail}`}
        />
      </div>

      <section className="score-cell mt-4 overflow-hidden">
        <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
          ROSTER
          {detail.roster.length > 0 ? (
            <span className="ml-2 font-mono text-[10px] tracking-normal text-white/45">
              {detail.roster.length} PLAYERS
            </span>
          ) : null}
        </h2>
        {detail.roster.length === 0 ? (
          <p className="px-3 py-6 font-mono text-[11px] leading-relaxed text-white/50">
            {coverage.roster.headline}. {coverage.roster.detail}
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {groupedRoster.map((group) => (
              <RosterGroup key={group.id} group={group.id} players={group.players} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}