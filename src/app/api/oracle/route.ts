import { askOracle, parseOracleRequest } from "@/lib/oracle";
import { isLeagueNotShippedError } from "@/lib/leagues";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OracleInput = {
  question?: string | null;
  q?: string | null;
  league?: string | null;
  gameId?: string | null;
  teamId?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function handle(input: OracleInput) {
  const parsed = parseOracleRequest(input);
  try {
    const result = await askOracle(parsed);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    if (isLeagueNotShippedError(error)) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Oracle unavailable";
    return NextResponse.json(
      { error: message, source: "espn", demo: false, league: parsed.league },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handle({
    q: url.searchParams.get("q") ?? url.searchParams.get("question"),
    league: url.searchParams.get("league"),
    gameId: url.searchParams.get("gameId"),
    teamId: url.searchParams.get("teamId"),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", source: "espn", demo: false },
      { status: 400 }
    );
  }
  return handle({
    question: asString(body.question) ?? asString(body.q),
    league: asString(body.league),
    gameId: asString(body.gameId),
    teamId: asString(body.teamId),
  });
}
