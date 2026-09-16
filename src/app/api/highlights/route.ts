import { parseLeagueParam } from "@/lib/leagues";
import { emptyHighlightsBoard, loadHighlights } from "@/lib/youtube";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = parseLeagueParam(url.searchParams.get("league"));
  const now = new Date();
  try {
    const board = await loadHighlights({
      league,
      apiKey: process.env.YOUTUBE_API_KEY,
      now,
    });
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(emptyHighlightsBoard(league, now), {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  }
}
