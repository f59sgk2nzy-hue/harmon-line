import { BoardHeader } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { StandingsView } from "@/components/standings-view";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getStandings, parseConferenceParam } from "@/lib/espn-standings";
import { parseLeagueParam } from "@/lib/leagues";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const label =
    league === "cfb"
      ? "College Football"
      : league === "mbb"
        ? "Men’s College Basketball"
        : league.toUpperCase();
  return { title: `${label} Standings — The Harmon Line` };
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const conference = parseConferenceParam(firstString(params.conference));
  let data = null;
  let error: string | null = null;
  try {
    data = await getStandings(league, conference);
  } catch (err) {
    error = err instanceof Error ? err.message : "Standings unavailable";
  }

  const dateLabel = data?.seasonYear
    ? String(data.seasonYear)
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader dateLabel={dateLabel} section="standings" league={league} />
      <PageTransition>
        <StandingsView
          key={`${league}-${conference}`}
          initial={data}
          initialError={error}
          conference={conference}
          league={league}
        />
      </PageTransition>
    </>
  );
}
