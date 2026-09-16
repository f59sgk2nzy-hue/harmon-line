import { attachResearchGraphs } from "@/lib/espn-winprob";
import { parseLeagueParam } from "@/lib/leagues";
import { getResearchBrief, loadResearchFeed } from "@/lib/research";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feed = await loadResearchFeed();
  const id = url.searchParams.get("id");
  const brief = id ? getResearchBrief(feed, id) : null;
  const league = parseLeagueParam(url.searchParams.get("league"));
  const graphs =
    id && !brief
      ? { xrayGraph: null, featuredXrayGraph: null }
      : await attachResearchGraphs({
          feed,
          selected: brief,
          fallbackLeague: league,
        });
  return NextResponse.json(
    {
      ...feed,
      brief,
      ...graphs,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
