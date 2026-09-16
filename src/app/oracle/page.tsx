import { BoardHeader } from "@/components/header";
import { OracleView } from "@/components/oracle-view";
import { PageTransition } from "@/components/page-transition";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { parseLeagueParam } from "@/lib/leagues";
import { askOracle } from "@/lib/oracle";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export const metadata: Metadata = {
  title: "Stat Oracle — The Harmon Line",
  description:
    "Ask a situational sports question. Harmon Line answers from public ESPN summary, scoreboard, and rankings JSON — evidence vs inference, never invented stats.",
};

export default async function OraclePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const question = (firstString(params.q) ?? firstString(params.question) ?? "").trim();
  const gameId = firstString(params.gameId);
  const teamId = firstString(params.teamId);

  let result = null;
  let error: string | null = null;
  if (question) {
    try {
      result = await askOracle({ question, league, gameId, teamId });
    } catch (err) {
      error = err instanceof Error ? err.message : "Oracle unavailable";
    }
  }

  return (
    <>
      <BoardHeader
        dateLabel={formatBoardDate(todayEspnDate())}
        section="oracle"
        league={league}
      />
      <PageTransition>
        <OracleView
          league={league}
          gameId={gameId}
          teamId={teamId}
          question={question}
          result={result}
          error={error}
        />
      </PageTransition>
    </>
  );
}
