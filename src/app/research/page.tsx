import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { ResearchView } from "@/components/research-view";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { parseLeagueParam } from "@/lib/leagues";
import { getResearchBrief, loadResearchFeed } from "@/lib/research";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export const metadata: Metadata = {
  title: "Research — The Harmon Line",
  description:
    "Read-only Deep Lore anomaly briefs and Post-Game Tactical X-Rays from Board routines. Evidence vs inference. Nothing is invented when the feed is empty.",
};

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const requestedId = firstString(params.id);
  const feed = await loadResearchFeed();
  const selected = getResearchBrief(feed, requestedId);

  return (
    <>
      <BoardHeader
        dateLabel={formatBoardDate(todayEspnDate())}
        section="research"
        league={league}
      />
      <PageTransition>
        <ResearchView
          league={league}
          feed={feed}
          selected={selected}
          requestedId={requestedId}
        />
      </PageTransition>
    </>
  );
}
