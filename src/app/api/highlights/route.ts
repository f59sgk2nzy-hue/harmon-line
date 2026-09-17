import { homeHighlightsQuery } from "@/lib/highlights-home";
import { clipQueryFromSearchParams, withClipLookup } from "@/lib/scrub-film";
import { emptyHighlightsBoard, loadHighlights } from "@/lib/youtube";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = homeHighlightsQuery({
    league: url.searchParams.get("league"),
    date: url.searchParams.get("date"),
    week: url.searchParams.get("week") ? Number(url.searchParams.get("week")) : null,
  }).league;
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
