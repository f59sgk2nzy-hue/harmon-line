import { BoardHeader } from "@/components/header";
import { HighlightsStrip } from "@/components/highlights-strip";
import { PageTransition } from "@/components/page-transition";
import { ScoreboardView } from "@/components/scoreboard-view";
import { parseStatusFilter } from "@/lib/board-url";
import { formatBoardDate, parseDateParam } from "@/lib/dates";
import { getScoreboard, parseDivision, parseSubdivision } from "@/lib/espn";
import { parseSeasonYear, parseWeekParam } from "@/lib/espn-weeks";
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
  const week = parseWeekParam(firstString(params.week));
  const year = parseSeasonYear(firstString(params.year), date);
  const view = week ? "week" : "date";

  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getScoreboard({
      division,
      date,
      subdivision,
      week: view === "week" ? week : null,
      year: view === "week" ? year : null,
      view,
    });
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
      <BoardHeader dateLabel={formatBoardDate(date)} week={initial?.week ?? week} />
      <PageTransition>
        <HighlightsStrip initial={highlights} initialError={highlightsError} />
        <ScoreboardView
          key={`${division}-${date}-${subdivision}-${view}-${week ?? ""}`}
          initial={initial}
          initialError={initialError}
          date={date}
          division={division}
          subdivision={subdivision}
          conference={conference}
          status={status}
          query={query}
          week={week}
          year={year}
          view={view}
        />
      </PageTransition>
    </>
  );
}
