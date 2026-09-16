import { getGameDetail } from "@/lib/espn";
import { isLeagueNotShippedError, parseLeagueParam } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const league = parseLeagueParam(new URL(request.url).searchParams.get("league"));
  try {
    const detail = await getGameDetail(id, league);
    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "public, s-maxage=6, stale-while-revalidate=15",
      },
    });
  } catch (error) {
    if (isLeagueNotShippedError(error)) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Game unavailable";
    const status = message.includes("Invalid") || message.includes("not found") ? 404 : 502;
    return NextResponse.json(
      { error: message, source: "espn", demo: false, league },
      { status }
    );
  }
}
