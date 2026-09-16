import { getDeepDive } from "@/lib/espn-deep-dive";
import { isLeagueNotShippedError, parseLeagueParam } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const league = parseLeagueParam(new URL(request.url).searchParams.get("league"));
  if (league !== "cfb") {
    return NextResponse.json(
      {
        error: "Deep Dive / Sim is college football only in this build",
        source: "espn",
        demo: false,
        league,
      },
      { status: 501 }
    );
  }
  try {
    const detail = await getDeepDive(id);
    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    if (isLeagueNotShippedError(error)) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Deep Dive unavailable";
    const status = message.includes("Invalid") || message.includes("not found") ? 404 : 502;
    return NextResponse.json(
      { error: message, source: "espn", demo: false, league },
      { status }
    );
  }
}
