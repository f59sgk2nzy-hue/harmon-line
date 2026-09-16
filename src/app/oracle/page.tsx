import { BoardHeader } from "@/components/header";
import { OracleView } from "@/components/oracle-view";
import { PageTransition } from "@/components/page-transition";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { geminiConfigured } from "@/lib/gemini-grounding";
import { parseLeagueParam } from "@/lib/leagues";
import { answerOracle, createDefaultOracleFeeds } from "@/lib/oracle";
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
    "Natural-language situational Q&A over public ESPN JSON, with optional Gemini Google Search grounding for historical and off-feed questions. Evidence vs inference. Scores are never invented.",
};

export default async function OraclePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const query = firstString(params.q) ?? "";
  const groundingEnabled = geminiConfigured();
  const data = query
    ? await answerOracle({ q: query, league }, createDefaultOracleFeeds())
    : null;

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
          query={query}
          data={data}
          groundingEnabled={groundingEnabled}
        />
      </PageTransition>
    </>
  );
}
