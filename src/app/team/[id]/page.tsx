import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { TeamPageView } from "@/components/team-page";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getTeamPage } from "@/lib/espn-team";
import { parseLeagueParam } from "@/lib/leagues";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const league = parseLeagueParam(firstString((await searchParams).league));
  try {
    const data = await getTeamPage(id, league);
    return { title: `${data.team.name} — The Harmon Line` };
  } catch {
    return { title: "Team — The Harmon Line" };
  }
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const league = parseLeagueParam(firstString((await searchParams).league));
  let data = null;
  let error: string | null = null;
  try {
    data = await getTeamPage(id, league);
  } catch (err) {
    error = err instanceof Error ? err.message : "Team unavailable";
  }

  return (
    <>
      <BoardHeader
        dateLabel={data?.team.abbreviation ?? formatBoardDate(todayEspnDate())}
        league={league}
      />
      <PageTransition>
        <TeamPageView data={data} error={error} league={league} />
      </PageTransition>
    </>
  );
}
