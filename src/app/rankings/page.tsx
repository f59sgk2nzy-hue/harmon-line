import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { RankingsView } from "@/components/rankings-view";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { POLL_TABS, getRankings, parsePollParam } from "@/lib/espn-rankings";
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
  const poll = parsePollParam(firstString(params.poll));
  const name = POLL_TABS.find((tab) => tab.id === poll)?.name ?? "Rankings";
  return { title: `${name} — The Harmon Line` };
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const poll = parsePollParam(firstString(params.poll));
  let data = null;
  let error: string | null = null;
  try {
    data = await getRankings(poll);
  } catch (err) {
    error = err instanceof Error ? err.message : "Rankings unavailable";
  }

  const dateLabel = data?.selected?.occurrence
    ? data.selected.occurrence
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader dateLabel={dateLabel} week={data?.week} section="rankings" />
      <PageTransition>
        <RankingsView key={poll} initial={data} initialError={error} poll={poll} />
      </PageTransition>
    </>
  );
}
