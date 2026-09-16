import { BoardHeader } from "@/components/header";
import { OpsView } from "@/components/ops-view";
import { PageTransition } from "@/components/page-transition";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { parseLeagueParam } from "@/lib/leagues";
import { buildOpsGraph } from "@/lib/ops";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export const metadata: Metadata = {
  title: "Ops — The Harmon Line",
  description:
    "Harmon Line agent graph: Chief Keef at the hub, The Board and roster spokes. Static roster until a live status feed is connected.",
};

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const league = parseLeagueParam(firstString(params.league));
  const busyParam = firstString(params.busy);
  const graph = buildOpsGraph({ busy: busyParam });

  return (
    <>
      <BoardHeader
        dateLabel={formatBoardDate(todayEspnDate())}
        section="ops"
        league={league}
      />
      <PageTransition>
        <OpsView graph={graph} league={league} busyParam={busyParam} />
      </PageTransition>
    </>
  );
}
