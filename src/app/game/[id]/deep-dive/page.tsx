import { BoardHeader } from "@/components/header";
import { DeepDiveView } from "@/components/deep-dive";
import { formatBoardDate, todayEspnDate } from "@/lib/dates";
import { getDeepDive } from "@/lib/espn-deep-dive";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getDeepDive(id);
    return {
      title: `Deep Dive · ${data.game.away.abbreviation} @ ${data.game.home.abbreviation} — The Harmon Line`,
    };
  } catch {
    return { title: "Deep Dive — The Harmon Line" };
  }
}

export default async function GameDeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data = null;
  let error: string | null = null;
  try {
    data = await getDeepDive(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Deep Dive unavailable";
  }

  const dateLabel = data?.game.date
    ? new Date(data.game.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : formatBoardDate(todayEspnDate());

  return (
    <>
      <BoardHeader dateLabel={dateLabel} week={data?.game.week} />
      <DeepDiveView data={data} error={error} />
    </>
  );
}
