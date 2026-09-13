import { getTeamPage } from "@/lib/espn-team";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const page = await getTeamPage(id);
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Team unavailable";
    const status = message.includes("Invalid") || message.includes("not found") ? 404 : 502;
    return NextResponse.json(
      { error: message, source: "espn", demo: false },
      { status }
    );
  }
}
