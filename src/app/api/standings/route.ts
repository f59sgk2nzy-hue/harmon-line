import { getStandings, parseConferenceParam } from "@/lib/espn-standings";
import { isLeagueNotShippedError, parseLeagueParam } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = parseLeagueParam(url.searchParams.get("league"));
  const conference = parseConferenceParam(url.searchParams.get("conference"));
  try {
    const standings = await getStandings(league, conference);
    return NextResponse.json(standings, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (isLeagueNotShippedError(error)) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Standings unavailable";
    return NextResponse.json(
      { error: message, source: "espn", demo: false, league },
      { status: 502 }
    );
  }
}
