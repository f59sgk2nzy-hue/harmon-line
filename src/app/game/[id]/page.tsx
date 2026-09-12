import { BoardHeader } from "@/components/header";
import { GameDetailView } from "@/components/game-detail";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getGameDetail } from "@/lib/espn";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getGameDetail(id);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Game unavailable";
  }

  const dateLabel = initial?.game.date
    ? new Date(initial.game.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader dateLabel={dateLabel} week={initial?.game.week} />
      <GameDetailView gameId={id} initial={initial} initialError={initialError} />
    </>
  );
}
