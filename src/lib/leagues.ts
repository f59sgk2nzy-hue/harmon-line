import type { CoverageNote, LeagueId } from "@/lib/types";

export const DEFAULT_LEAGUE: LeagueId = "cfb";

export const LEAGUE_IDS = ["cfb", "mbb", "nba", "nfl", "mlb"] as const satisfies readonly LeagueId[];

export type NavMode = "week" | "date";
export type LogoNamespace = "ncaa" | "nba" | "nfl" | "mlb";
export type DetailModuleKind = "drives" | "plays" | "atBats";

export type DetailModules = {
  primary: DetailModuleKind;
  footballSituation: boolean;
};

export type SportLeague = {
  id: LeagueId;
  sport: string;
  league: string;
  label: string;
  shortLabel: string;
  navMode: NavMode;
  logoNamespace: LogoNamespace;
  detailModules: DetailModules;
  rankings: boolean;
  shipped: boolean;
  coverage: CoverageNote;
};

export type UnshippedLeaguePayload = {
  error: string;
  source: "espn";
  demo: false;
  league: LeagueId;
  coverage: CoverageNote;
};

export const SPORT_LEAGUES: Record<LeagueId, SportLeague> = {
  cfb: {
    id: "cfb",
    sport: "football",
    league: "college-football",
    label: "College Football",
    shortLabel: "CFB",
    navMode: "week",
    logoNamespace: "ncaa",
    detailModules: { primary: "drives", footballSituation: true },
    rankings: true,
    shipped: true,
    coverage: {
      headline: "College football — ESPN public scoreboard",
      detail:
        "NCAA D1 (FBS + FCS), D2, and partial NAIA from ESPN’s unofficial public site API. Scores are never invented. Play-by-play depends on ESPN publishing a summary feed.",
    },
  },
  mbb: {
    id: "mbb",
    sport: "basketball",
    league: "mens-college-basketball",
    label: "Men’s College Basketball",
    shortLabel: "MBB",
    navMode: "date",
    logoNamespace: "ncaa",
    detailModules: { primary: "plays", footballSituation: false },
    rankings: true,
    shipped: true,
    coverage: {
      headline: "Men’s college basketball — ESPN public scoreboard",
      detail:
        "NCAA Division I from ESPN group 50 (mens-college-basketball). Date nav uses ESPN dates=YYYYMMDD, not football week chips. September slates are often empty out of season. D2/NAIA basketball is not on this board. Scores are never invented.",
    },
  },
  nba: {
    id: "nba",
    sport: "basketball",
    league: "nba",
    label: "NBA",
    shortLabel: "NBA",
    navMode: "date",
    logoNamespace: "nba",
    detailModules: { primary: "plays", footballSituation: false },
    rankings: false,
    shipped: true,
    coverage: {
      headline: "NBA — ESPN public scoreboard",
      detail:
        "NBA slate from ESPN’s unofficial public site API (basketball/nba). Date nav uses dates=YYYYMMDD, not football week chips. Rankings 404 on this feed and are not shown. Deep Dive, odds, pickcenter, winprob, and ATS stay off this board. Scores are never invented.",
    },
  },
  nfl: {
    id: "nfl",
    sport: "football",
    league: "nfl",
    label: "NFL",
    shortLabel: "NFL",
    navMode: "week",
    logoNamespace: "nfl",
    detailModules: { primary: "drives", footballSituation: true },
    rankings: false,
    shipped: true,
    coverage: {
      headline: "NFL — ESPN public scoreboard",
      detail:
        "32-team NFL slate from ESPN’s unofficial public site API (football/nfl). Week nav uses week/year/seasontype. Regular season is the default; preseason and postseason chips appear only when ESPN’s calendar published them. No college D1/D2/NAIA groups. Rankings, Deep Dive, CFBD, and odds/pickcenter/winprob stay off this board. Scores are never invented.",
    },
  },
  mlb: {
    id: "mlb",
    sport: "baseball",
    league: "mlb",
    label: "MLB",
    shortLabel: "MLB",
    navMode: "date",
    logoNamespace: "mlb",
    detailModules: { primary: "atBats", footballSituation: false },
    rankings: false,
    shipped: true,
    coverage: {
      headline: "MLB — ESPN public scoreboard",
      detail:
        "MLB slate from ESPN’s unofficial public site API (baseball/mlb). Date nav uses dates=YYYYMMDD, not football week chips. Rankings 404 on this feed and are not shown. Deep Dive, odds, pickcenter, winprob, and ATS stay off this board. Extra innings and doubleheaders appear only when ESPN published them. Scores are never invented.",
    },
  },
};

const LEAGUE_SET = new Set<string>(LEAGUE_IDS);

export function parseLeagueParam(value: string | null | undefined): LeagueId {
  const slug = (value ?? "").trim().toLowerCase();
  if (LEAGUE_SET.has(slug)) return slug as LeagueId;
  return DEFAULT_LEAGUE;
}

export function getLeague(id: string | null | undefined): SportLeague {
  return SPORT_LEAGUES[parseLeagueParam(id)];
}

export function shippedLeagues(): SportLeague[] {
  return LEAGUE_IDS.map((id) => SPORT_LEAGUES[id]).filter((league) => league.shipped);
}

export class LeagueNotShippedError extends Error {
  readonly league: SportLeague;
  readonly status = 501;
  readonly payload: UnshippedLeaguePayload;

  constructor(league: SportLeague) {
    const error = `${league.label} is not on The Harmon Line yet`;
    super(error);
    this.name = "LeagueNotShippedError";
    this.league = league;
    this.payload = {
      error,
      source: "espn",
      demo: false,
      league: league.id,
      coverage: league.coverage,
    };
  }
}

export function assertLeagueShipped(id: string | null | undefined): SportLeague {
  const league = getLeague(id);
  if (!league.shipped) throw new LeagueNotShippedError(league);
  return league;
}

export function isLeagueNotShippedError(error: unknown): error is LeagueNotShippedError {
  return error instanceof LeagueNotShippedError;
}

/** Favorites / pins must be league-scoped so ESPN team ids do not collide across sports. */
export function favoriteKey(league: LeagueId, teamId: string): string {
  return `${parseLeagueParam(league)}:${teamId}`;
}
