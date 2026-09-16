import { BoardHeader } from "@/components/header";
import { GameDetailView } from "@/components/game-detail";
import { PageTransition } from "@/components/page-transition";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getGameDetail } from "@/lib/espn";
import { getLeague, parseLeagueParam } from "@/lib/leagues";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const league = parseLeagueParam(
    typeof query.league === "string" ? query.league : Array.isArray(query.league) ? query.league[0] : null
  );
  const spec = getLeague(league);
  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getGameDetail(id, league);
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
      <BoardHeader
        dateLabel={dateLabel}
        week={spec.navMode === "week" ? initial?.game.week : null}
        league={league}
      />
      <PageTransition>
        <GameDetailView
          gameId={id}
          initial={initial}
          initialError={initialError}
          league={league}
        />
      </PageTransition>
    </>
  );
}
