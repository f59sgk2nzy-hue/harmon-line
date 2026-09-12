export type DivisionId = "d1" | "d2" | "naia";
export type SubdivisionId = "all" | "fbs" | "fcs";
export type GameState = "pre" | "in" | "post";
export type StatusFilter = "all" | "live" | "final" | "upcoming";

export type TeamSide = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  score: number | null;
  record: string | null;
  rank: number | null;
  color: string | null;
  altColor: string | null;
  logo: string;
  conferenceId: string | null;
  conferenceName: string | null;
  winner: boolean;
  linescores: number[];
  homeAway: "home" | "away";
};

export type GameSituation = {
  down: number | null;
  distance: number | null;
  downDistanceText: string | null;
  possessionText: string | null;
  possessionTeamId: string | null;
  isRedZone: boolean;
  lastPlay: string | null;
  homeTimeouts: number | null;
  awayTimeouts: number | null;
};

export type GameSummary = {
  id: string;
  name: string;
  shortName: string;
  date: string;
  week: number | null;
  status: {
    state: GameState;
    detail: string;
    shortDetail: string;
    period: number | null;
    clock: string | null;
    completed: boolean;
  };
  home: TeamSide;
  away: TeamSide;
  venue: string | null;
  venueCity: string | null;
  broadcast: string | null;
  situation: GameSituation | null;
  playByPlayAvailable: boolean;
  subdivision: "FBS" | "FCS" | "D2" | "NAIA";
  conferenceIds: string[];
};

export type ConferenceOption = {
  id: string;
  name: string;
  abbreviation?: string;
};

export type CoverageNote = {
  headline: string;
  detail: string;
};

export type ScoreboardResponse = {
  source: "espn";
  demo: false;
  date: string;
  division: DivisionId;
  week: number | null;
  generatedAt: string;
  games: GameSummary[];
  conferences: ConferenceOption[];
  liveCount: number;
  coverage: CoverageNote;
};

export type PlayByPlayPlay = {
  id: string;
  text: string;
  period: number | null;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scoringPlay: boolean;
  type: string | null;
  teamId: string | null;
};

export type Drive = {
  id: string;
  description: string | null;
  result: string | null;
  teamId: string | null;
  teamName: string | null;
  yards: number | null;
  plays: PlayByPlayPlay[];
};

export type ScoringPlay = {
  id: string;
  text: string;
  period: number | null;
  clock: string | null;
  homeScore: number;
  awayScore: number;
  teamId: string | null;
  teamName: string | null;
  type: string | null;
};

export type LeaderLine = {
  category: string;
  name: string;
  displayValue: string;
  teamId: string | null;
};

export type GameDetailResponse = {
  source: "espn";
  demo: false;
  generatedAt: string;
  game: GameSummary;
  scoringPlays: ScoringPlay[];
  drives: Drive[];
  leaders: LeaderLine[];
  playByPlayAvailable: boolean;
  coverage: CoverageNote;
};
