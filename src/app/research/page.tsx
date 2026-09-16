import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { ResearchView } from "@/components/research-view";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { parseLeagueParam } from "@/lib/leagues";
import { getResearchBrief, loadResearchFeed } from "@/lib/research";
import { answerResearchAsk, createGoogleSearchClient, googleSearchConfigured } from "@/lib/research-ask";
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
    "Google-grounded sports research answers plus read-only Deep Lore briefs and Post-Game X-Rays. Evidence vs inference. Nothing is invented when Search is missing or the disk feed is empty.",
};

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const requestedId = firstString(params.id);
  const query = firstString(params.q) ?? "";
  const feed = await loadResearchFeed();
  const selected = getResearchBrief(feed, requestedId);
  const googleConfigured = googleSearchConfigured();
  const ask = query
    ? await answerResearchAsk({ q: query, league }, createGoogleSearchClient())
    : null;

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
          query={query}
          ask={ask}
          googleConfigured={googleConfigured}
        />
      </PageTransition>
    </>
  );
}
