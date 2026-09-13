import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { TeamPageView } from "@/components/team-page";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getTeamPage } from "@/lib/espn-team";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getTeamPage(id);
    return { title: `${data.team.name} — The Harmon Line` };
  } catch {
    return { title: "Team — The Harmon Line" };
  }
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data = null;
  let error: string | null = null;
  try {
    data = await getTeamPage(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Team unavailable";
  }

  return (
    <>
      <BoardHeader dateLabel={data?.team.abbreviation ?? formatBoardDate(todayEspnDate())} />
      <PageTransition>
        <TeamPageView data={data} error={error} />
      </PageTransition>
    </>
  );
}
