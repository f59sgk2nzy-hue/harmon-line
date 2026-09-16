import { getResearchBrief, loadResearchFeed } from "@/lib/research";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feed = await loadResearchFeed();
  const id = url.searchParams.get("id");
  const brief = id ? getResearchBrief(feed, id) : null;
  return NextResponse.json(
    {
      ...feed,
      brief,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
