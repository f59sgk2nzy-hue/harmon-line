import { isEspnDate, todayEspnDate } from "@/lib/dates";
import { getScoreboard, parseDivision, parseSubdivision } from "@/lib/espn";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const division = parseDivision(url.searchParams.get("division"));
  const subdivision = parseSubdivision(url.searchParams.get("subdivision"));
  const dateParam = url.searchParams.get("date");
  const date = isEspnDate(dateParam) ? dateParam : todayEspnDate();

  try {
    const board = await getScoreboard({ division, date, subdivision });
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scoreboard unavailable";
    return NextResponse.json(
      {
        error: message,
        source: "espn",
        demo: false,
        date,
        division,
      },
      { status: 502 }
    );
  }
}
