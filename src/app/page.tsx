import { BoardHeader } from "@/components/header";
import { HighlightsStrip } from "@/components/highlights-strip";
import { PageTransition } from "@/components/page-transition";
import { ScoreboardView } from "@/components/scoreboard-view";
import { parseStatusFilter } from "@/lib/board-url";
import { formatBoardDate, parseDateParam } from "@/lib/dates";
import { getScoreboard, parseDivision, parseSubdivision } from "@/lib/espn";
import { loadHighlights, sampleHighlightsBoard } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const date = parseDateParam(firstString(params.date));
  const division = parseDivision(firstString(params.division));
  const subdivision = parseSubdivision(firstString(params.subdivision));
  const conference = firstString(params.conference) ?? "all";
  const status = parseStatusFilter(firstString(params.status));
  const query = firstString(params.q) ?? "";

  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getScoreboard({ division, date, subdivision });
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Scoreboard unavailable";
  }

  let highlights = null;
  let highlightsError: string | null = null;
  try {
    highlights = await loadHighlights({ apiKey: process.env.YOUTUBE_API_KEY });
  } catch (error) {
    highlightsError = error instanceof Error ? error.message : "Highlights unavailable";
    highlights = sampleHighlightsBoard();
  }

  return (
    <>
      <BoardHeader dateLabel={formatBoardDate(date)} week={initial?.week} />
      <PageTransition>
        <HighlightsStrip initial={highlights} initialError={highlightsError} />
        <ScoreboardView
          key={`${division}-${date}-${subdivision}`}
          initial={initial}
          initialError={initialError}
          date={date}
          division={division}
          subdivision={subdivision}
          conference={conference}
          status={status}
          query={query}
        />
      </PageTransition>
    </>
  );
}
