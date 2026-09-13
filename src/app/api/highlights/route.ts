import { loadHighlights, sampleHighlightsBoard } from "@/lib/youtube";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  try {
    const board = await loadHighlights({
      apiKey: process.env.YOUTUBE_API_KEY,
      now,
    });
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(sampleHighlightsBoard(now), {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  }
}
