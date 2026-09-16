import { boardHref, parseStatusFilter } from "@/lib/board-url";
import { parseDateParam } from "@/lib/dates";
import { parseDivision, parseSubdivision } from "@/lib/espn";
import { parseSeasonYear, parseWeekParam } from "@/lib/espn-weeks";
import { redirectPreservingHost } from "@/lib/http";
import { parseLeagueParam } from "@/lib/leagues";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const src = new URL(request.url);
  const date = parseDateParam(src.searchParams.get("date"));
  const week = parseWeekParam(src.searchParams.get("week"));
  const dest = boardHref({
    division: parseDivision(src.searchParams.get("division")),
    date,
    subdivision: parseSubdivision(src.searchParams.get("subdivision")),
    conference: src.searchParams.get("conference") ?? "all",
    status: parseStatusFilter(src.searchParams.get("status")),
    q: src.searchParams.get("q") ?? "",
    week,
    year: week ? parseSeasonYear(src.searchParams.get("year"), date) : null,
    league: parseLeagueParam(src.searchParams.get("league")),
  });
  return redirectPreservingHost(request, dest);
}
