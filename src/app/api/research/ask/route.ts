import { answerResearchAsk, createGoogleSearchClient } from "@/lib/research-ask";
import { parseLeagueParam } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function askFromRequest(request: Request, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  const qRaw = body?.q ?? url.searchParams.get("q") ?? "";
  const q = typeof qRaw === "string" ? qRaw : "";
  const leagueRaw = body?.league ?? url.searchParams.get("league");
  const league = parseLeagueParam(typeof leagueRaw === "string" ? leagueRaw : null);
  return answerResearchAsk({ q, league }, createGoogleSearchClient());
}

export async function GET(request: Request) {
  const payload = await askFromRequest(request);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
    },
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }
  const payload = await askFromRequest(request, body);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
