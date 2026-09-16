import { BoardHeader } from "@/components/header";
import { HighlightsStrip } from "@/components/highlights-strip";
import { PageTransition } from "@/components/page-transition";
import { ScoreboardView } from "@/components/scoreboard-view";
import { parseStatusFilter } from "@/lib/board-url";
import { formatBoardDate, parseDateParam } from "@/lib/dates";
import { getScoreboard, parseDivision, parseSubdivision } from "@/lib/espn";
import { parseSeasonType, parseSeasonYear, parseWeekParam } from "@/lib/espn-weeks";
import { getLeague, parseLeagueParam } from "@/lib/leagues";
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
  const league = parseLeagueParam(firstString(params.league));
  const spec = getLeague(league);
  const dateParam = firstString(params.date);
  const date = parseDateParam(dateParam);
  const division = league === "cfb" ? parseDivision(firstString(params.division)) : "d1";
  const subdivision = league === "cfb" ? parseSubdivision(firstString(params.subdivision)) : "all";
  const conference = firstString(params.conference) ?? "all";
  const status = parseStatusFilter(firstString(params.status));
  const query = firstString(params.q) ?? "";
  const week = spec.navMode === "week" ? parseWeekParam(firstString(params.week)) : null;
  const year = parseSeasonYear(firstString(params.year), date);
  const seasonType = parseSeasonType(firstString(params.seasontype), league);
  const view =
    league === "nfl" ? (week || !dateParam ? "week" : "date") : week ? "week" : "date";

  let initial = null;
  let initialError: string | null = null;
  try {
    initial = await getScoreboard({
      league,
      division,
      date,
      subdivision,
      week: view === "week" ? week : null,
      year: view === "week" ? year : null,
      seasonType: league === "nfl" && view === "week" ? seasonType : null,
      view,
    });
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Scoreboard unavailable";
  }

  let highlights = null;
  let highlightsError: string | null = null;
  if (league === "cfb") {
    try {
      highlights = await loadHighlights({ apiKey: process.env.YOUTUBE_API_KEY });
    } catch (error) {
      highlightsError = error instanceof Error ? error.message : "Highlights unavailable";
      highlights = sampleHighlightsBoard();
    }
  }

  return (
    <>
      <BoardHeader
        dateLabel={formatBoardDate(date)}
        week={initial?.week ?? week}
        league={league}
      />
      <PageTransition>
        {league === "cfb" ? (
          <HighlightsStrip initial={highlights} initialError={highlightsError} />
        ) : null}
        <ScoreboardView
          key={`${league}-${division}-${date}-${subdivision}-${view}-${week ?? ""}-${seasonType}`}
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
          seasonType={league === "nfl" ? (initial?.seasonType ?? seasonType) : null}
          view={view}
          league={league}
        />
      </PageTransition>
    </>
  );
}
