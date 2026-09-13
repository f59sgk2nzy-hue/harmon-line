import { loadHighlights, sampleHighlightVideos, currentCfbSeasonYear } from "@/lib/youtube";
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
    const seasonYear = currentCfbSeasonYear(now);
    return NextResponse.json(
      {
        source: "sample",
        sample: true,
        seasonYear,
        generatedAt: now.toISOString(),
        apiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
        videos: sampleHighlightVideos(seasonYear),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  }
}
