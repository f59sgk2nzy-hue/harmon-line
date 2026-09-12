import { boardHref, parseStatusFilter } from "@/lib/board-url";
import { parseDateParam } from "@/lib/dates";
import { parseDivision, parseSubdivision } from "@/lib/espn";
import { redirectPreservingHost } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const src = new URL(request.url);
  const dest = boardHref({
    division: parseDivision(src.searchParams.get("division")),
    date: parseDateParam(src.searchParams.get("date")),
    subdivision: parseSubdivision(src.searchParams.get("subdivision")),
    conference: src.searchParams.get("conference") ?? "all",
    status: parseStatusFilter(src.searchParams.get("status")),
    q: src.searchParams.get("q") ?? "",
  });
  return redirectPreservingHost(request, dest);
}
