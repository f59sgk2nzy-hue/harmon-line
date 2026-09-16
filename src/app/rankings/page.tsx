import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { RankingsView } from "@/components/rankings-view";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getRankings, parsePollParam, pollTabsFor } from "@/lib/espn-rankings";
import { parseLeagueParam } from "@/lib/leagues";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const poll = parsePollParam(firstString(params.poll), league);
  const name = pollTabsFor(league).find((tab) => tab.id === poll)?.name ?? "Rankings";
  return { title: `${name} — The Harmon Line` };
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const poll = parsePollParam(firstString(params.poll), league);
  let data = null;
  let error: string | null = null;
  try {
    data = await getRankings(poll, league);
  } catch (err) {
    error = err instanceof Error ? err.message : "Rankings unavailable";
  }

  const dateLabel = data?.selected?.occurrence
    ? data.selected.occurrence
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader
        dateLabel={dateLabel}
        week={data?.week}
        section="rankings"
        league={league}
      />
      <PageTransition>
        <RankingsView key={`${league}-${poll}`} initial={data} initialError={error} poll={poll} league={league} />
      </PageTransition>
    </>
  );
}
