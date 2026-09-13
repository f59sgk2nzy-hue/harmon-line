import { BoardHeader } from "@/components/header";
import { TeamDetailView } from "@/components/team-detail";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getTeamDetail } from "@/lib/espn";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getTeamDetail(id);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Team unavailable";
  }

  const dateLabel = initial?.team.shortName
    ? initial.team.name
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader dateLabel={dateLabel} />
      <TeamDetailView teamId={id} initial={initial} initialError={initialError} />
    </>
  );
}