import { getRankings, parsePollParam } from "@/lib/espn-rankings";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const poll = parsePollParam(url.searchParams.get("poll"));
  try {
    const rankings = await getRankings(poll);
    return NextResponse.json(rankings, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rankings unavailable";
    return NextResponse.json(
      { error: message, source: "espn", demo: false },
      { status: 502 }
    );
  }
}
