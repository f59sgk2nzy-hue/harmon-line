import { FavoritesView } from "@/components/favorites-view";
import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { parseLeagueParam } from "@/lib/leagues";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export const metadata: Metadata = {
  title: "Favorites — The Harmon Line",
  description:
    "Followed teams hub. Pins live in this browser only — no account. Star a school or club on a team page or game card. Scores are never invented.",
};

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));

  return (
    <>
      <BoardHeader
        dateLabel={formatBoardDate(todayEspnDate())}
        section="favorites"
        league={league}
      />
      <PageTransition>
        <FavoritesView league={league} />
      </PageTransition>
    </>
  );
}
