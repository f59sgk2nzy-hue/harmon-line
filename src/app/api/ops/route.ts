import { buildOpsGraph } from "@/lib/ops";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const graph = buildOpsGraph({
    busy: url.searchParams.get("busy"),
  });
  return NextResponse.json(graph, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
