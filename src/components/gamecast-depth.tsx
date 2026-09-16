"use client";

import { TeamLogo } from "@/components/team-logo";
import { pairTeamStatRows } from "@/lib/espn-gamecast";
import { teamHref } from "@/lib/espn-team";
import type {
  GamecastNews,
  PlayerBoxCategory,
  PlayerBoxTeam,
  PlayerBoxscore,
  StandingsSnippet,
  TeamBoxStats,
} from "@/lib/types";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function ModuleFrame({
  kicker,
  children,
}: {
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section className="board-glass">
      <h2 className="border-b border-white/10 px-3 py-2 font-display text-xs tracking-[0.18em] text-[#f3c14b]">
        {kicker}
      </h2>
      {children}
    </section>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="px-3 py-4 font-mono text-[11px] text-white/45">{children}</p>;
}

function TeamStatsModule({ teams }: { teams: TeamBoxStats[] }) {
  const away = teams.find((row) => row.homeAway === "away") ?? teams[0];
  const home = teams.find((row) => row.homeAway === "home") ?? teams[1];
  const rows = pairTeamStatRows(teams);
  if (rows.length === 0) return null;

  return (
    <ModuleFrame kicker="TEAM STATS">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-2 border-b border-white/10 px-3 py-2 font-display text-[10px] tracking-[0.14em] text-white/45">
        <span className="text-left text-white/80">{away?.abbreviation ?? "AWAY"}</span>
        <span className="text-center">STAT</span>
        <span className="text-right text-white/80">{home?.abbreviation ?? "HOME"}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0"
          >
            <span className="font-mono text-[12px] text-white">{row.away ?? "—"}</span>
            <span className="text-center font-display text-[10px] tracking-[0.12em] text-white/50">
              {row.label.toUpperCase()}
            </span>
            <span className="text-right font-mono text-[12px] text-white">{row.home ?? "—"}</span>
          </li>
        ))}
      </ul>
    </ModuleFrame>
  );
}

function CategoryTable({ category }: { category: PlayerBoxCategory }) {
  return (
    <div className="border-t border-white/8">
      <p className="px-3 py-2 font-display text-[10px] tracking-[0.16em] text-[#f3c14b]">
        {category.text.toUpperCase()}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="font-display text-[10px] tracking-[0.12em] text-white/40">
              <th className="sticky left-0 bg-[#121212] px-3 py-1 font-normal">PLAYER</th>
              {category.labels.map((label) => (
                <th key={label} className="whitespace-nowrap px-2 py-1 text-right font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.athletes.map((athlete, index) => (
              <tr key={athlete.id ?? `${athlete.name}-${index}`} className="border-t border-white/5">
                <td className="sticky left-0 bg-[#121212] whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-white">
                  {athlete.jersey ? (
                    <span className="mr-1.5 text-white/40">#{athlete.jersey}</span>
                  ) : null}
                  {athlete.name}
                </td>
                {category.labels.map((label, cell) => (
                  <td
                    key={`${athlete.name}-${label}`}
                    className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-[11px] text-white/80"
                  >
                    {athlete.stats[cell] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
            {category.totals ? (
              <tr className="border-t border-white/10">
                <td className="sticky left-0 bg-[#121212] px-3 py-1.5 font-display text-[10px] tracking-[0.12em] text-white/50">
                  TEAM
                </td>
                {category.labels.map((label, cell) => (
                  <td
                    key={`total-${label}`}
                    className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-[11px] text-white/70"
                  >
                    {category.totals?.[cell] ?? ""}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerBoxTeamBlock({ team }: { team: PlayerBoxTeam }) {
  return (
    <div className="border-t border-white/10 first:border-t-0">
      <div className="flex min-h-11 items-center gap-2 px-3 py-2">
        <Link
          href={teamHref(team.teamId)}
          className="pressable tap-row inline-flex min-h-11 min-w-0 items-center gap-2 no-underline"
        >
          <TeamLogo src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${team.teamId}.png`} alt="" abbreviation={team.abbreviation} size={28} />
          <span className="font-display text-sm tracking-[0.14em] text-white">
            {team.abbreviation}
          </span>
        </Link>
        <span className="truncate font-mono text-[11px] text-white/45">{team.teamName}</span>
      </div>
      {team.categories.length === 0 ? (
        <EmptyCopy>No player categories published for {team.abbreviation}.</EmptyCopy>
      ) : (
        team.categories.map((category) => (
          <CategoryTable key={`${team.teamId}-${category.name}`} category={category} />
        ))
      )}
    </div>
  );
}

function PlayerBoxModule({ box }: { box: PlayerBoxscore }) {
  return (
    <ModuleFrame kicker="BOX SCORE">
      {!box.available ? (
        <EmptyCopy>BOX SCORE NOT ON THIS FEED YET</EmptyCopy>
      ) : (
        box.teams.map((team) => <PlayerBoxTeamBlock key={team.teamId} team={team} />)
      )}
    </ModuleFrame>
  );
}

function StandingsModule({ snippet }: { snippet: StandingsSnippet }) {
  return (
    <ModuleFrame kicker="STANDINGS">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <p className="font-mono text-[11px] text-white/55">
          {snippet.header ?? "Conference records as published on this summary."}
        </p>
        {snippet.fullViewLink ? (
          <a
            href={snippet.fullViewLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex min-h-11 items-center gap-1.5 font-display text-[10px] tracking-[0.16em] text-[#ffb3b3] no-underline"
          >
            {snippet.fullViewLink.text.toUpperCase()}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
      <div className="divide-y divide-white/8">
        {snippet.groups.map((group, index) => (
          <div key={group.header ?? `group-${index}`}>
            {group.header ? (
              <p className="px-3 py-2 font-display text-[10px] tracking-[0.14em] text-white/40">
                {group.header.toUpperCase()}
              </p>
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] gap-2 px-3 pb-1 font-display text-[10px] tracking-[0.12em] text-white/35">
              <span>TEAM</span>
              <span className="text-right">W-L</span>
              <span className="text-right">CONF</span>
            </div>
            <ul>
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={teamHref(entry.id)}
                    className="pressable tap-row grid min-h-11 grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-2 px-3 no-underline"
                  >
                    <span className="truncate font-display text-[13px] tracking-wide text-white">
                      {entry.name.toUpperCase()}
                    </span>
                    <span className="text-right font-mono text-[11px] text-white/80">
                      {entry.overall ?? ""}
                    </span>
                    <span className="text-right font-mono text-[11px] text-white/55">
                      {entry.conference ?? ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ModuleFrame>
  );
}

function NewsModule({ news }: { news: GamecastNews }) {
  return (
    <ModuleFrame kicker="NEWS">
      {news.article ? (
        <div className="border-b border-white/10 px-3 py-3">
          {news.article.type ? (
            <p className="font-display text-[10px] tracking-[0.18em] text-[#ff3b3b]">
              {news.article.type.toUpperCase()}
            </p>
          ) : null}
          {news.article.href ? (
            <a
              href={news.article.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable mt-1 inline-flex min-h-11 items-center font-display text-base leading-snug tracking-wide text-white no-underline"
            >
              {news.article.headline}
              <ExternalLink className="ml-2 size-3.5 shrink-0 text-white/45" aria-hidden />
            </a>
          ) : (
            <p className="mt-1 font-display text-base leading-snug tracking-wide text-white">
              {news.article.headline}
            </p>
          )}
        </div>
      ) : null}
      {news.articles.length === 0 && !news.article ? (
        <EmptyCopy>No preview, recap, or news links on this summary.</EmptyCopy>
      ) : (
        <ul className="divide-y divide-white/5">
          {news.articles.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable tap-row flex min-h-11 items-center justify-between gap-3 px-3 no-underline"
              >
                <span className="min-w-0">
                  {item.type ? (
                    <span className="mb-0.5 block font-display text-[10px] tracking-[0.14em] text-white/35">
                      {item.type.toUpperCase()}
                    </span>
                  ) : null}
                  <span className="block font-mono text-[12px] leading-snug text-white/85">
                    {item.headline}
                  </span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-white/40" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </ModuleFrame>
  );
}

export function GamecastDepth({
  teamStats,
  playerBox,
  standings,
  news,
}: {
  teamStats: TeamBoxStats[];
  playerBox: PlayerBoxscore;
  standings: StandingsSnippet | null;
  news: GamecastNews;
}) {
  const showNews = Boolean(news.article) || news.articles.length > 0;

  return (
    <div className="mt-4 space-y-4">
      {teamStats.length > 0 ? <TeamStatsModule teams={teamStats} /> : null}
      <PlayerBoxModule box={playerBox} />
      {standings ? <StandingsModule snippet={standings} /> : null}
      {showNews ? <NewsModule news={news} /> : null}
    </div>
  );
}
