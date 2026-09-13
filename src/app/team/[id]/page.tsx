import { BoardHeader } from "@/components/header";
import { TeamPageView } from "@/components/team-page";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getTeamPage } from "@/lib/espn-team";

export const dynamic = "force-dynamic";

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
      <TeamPageView data={data} error={error} />
    </>
  );
}
