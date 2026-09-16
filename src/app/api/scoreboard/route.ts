import { isEspnDate, todayEspnDate } from "@/lib/dates";
import { getScoreboard, parseDivision, parseSubdivision } from "@/lib/espn";
import { parseSeasonType, parseSeasonYear, parseWeekParam } from "@/lib/espn-weeks";
import { isLeagueNotShippedError, parseLeagueParam } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = parseLeagueParam(url.searchParams.get("league"));
  const division = parseDivision(url.searchParams.get("division"));
  const subdivision = parseSubdivision(url.searchParams.get("subdivision"));
  const dateParam = url.searchParams.get("date");
  const date = isEspnDate(dateParam) ? dateParam : todayEspnDate();
  const week = parseWeekParam(url.searchParams.get("week"));
  const year = parseSeasonYear(url.searchParams.get("year"), date);
  const seasonType = parseSeasonType(url.searchParams.get("seasontype"), league);
  const viewRaw = url.searchParams.get("view");
  const view =
    viewRaw === "week" || viewRaw === "date"
      ? viewRaw
      : week
        ? "week"
        : league === "nfl"
          ? "week"
          : "date";

  try {
    const board = await getScoreboard({
      league,
      division,
      date,
      subdivision,
      week: view === "week" ? week : null,
      year: view === "week" ? year : null,
      seasonType: league === "nfl" && view === "week" ? seasonType : null,
      view,
    });
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    if (isLeagueNotShippedError(error)) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Scoreboard unavailable";
    return NextResponse.json(
      {
        error: message,
        source: "espn",
        demo: false,
        league,
        date,
        division,
      },
      { status: 502 }
    );
  }
}
