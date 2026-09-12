import { getGameDetail } from "@/lib/espn";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const detail = await getGameDetail(id);
    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "public, s-maxage=6, stale-while-revalidate=15",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Game unavailable";
    const status = message.includes("Invalid") || message.includes("not found") ? 404 : 502;
    return NextResponse.json(
      { error: message, source: "espn", demo: false },
      { status }
    );
  }
}
