import { parseLeagueParam } from "@/lib/leagues";
import { clipQueryFromSearchParams, withClipLookup } from "@/lib/scrub-film";
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
    const clipQuery = clipQueryFromSearchParams(url.searchParams);
    const payload = clipQuery ? withClipLookup(board, clipQuery) : board;
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    const empty = emptyHighlightsBoard(league, now);
    const clipQuery = clipQueryFromSearchParams(url.searchParams);
    return NextResponse.json(clipQuery ? withClipLookup(empty, clipQuery) : empty, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  }
}
