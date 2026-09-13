import { BoardHeader } from "@/components/header";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { deepDiveHref, nextDeepDiveGameId } from "@/lib/espn-stats";
import { getTeamPage, teamHref } from "@/lib/espn-team";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamDeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let page;
  try {
    page = await getTeamPage(id);
  } catch (error) {
    return (
      <>
        <BoardHeader dateLabel={formatBoardDate(todayEspnDate())} />
        <div className="mx-auto max-w-5xl px-4 py-10 pb-16">
          <Link href="/" className="font-display text-xs tracking-[0.16em] text-white/60">
            ← BACK TO THE BOARD
          </Link>
          <p className="mt-6 font-display text-2xl tracking-[0.12em] text-white">
            {error instanceof Error ? error.message : "Team unavailable"}
          </p>
        </div>
      </>
    );
  }

  const gameId = nextDeepDiveGameId(page.upcoming, page.recent);
  if (gameId) {
    redirect(deepDiveHref(gameId));
  }

  return (
    <>
      <BoardHeader dateLabel={page.team.abbreviation} />
      <div className="mx-auto max-w-5xl px-4 py-10 pb-16">
        <Link
          href={teamHref(id)}
          className="inline-flex min-h-11 items-center gap-1.5 font-display text-xs tracking-[0.16em] text-white/70"
        >
          <ArrowLeft className="size-3.5" />
          TEAM
        </Link>
        <p className="mt-6 font-display text-2xl tracking-[0.12em] text-white">
          NO MATCHUP ON THIS FEED
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-white/50">
          ESPN published no upcoming or recent games for {page.team.name}. Deep Dive needs a real
          matchup id — scores are never invented.
        </p>
      </div>
    </>
  );
}
