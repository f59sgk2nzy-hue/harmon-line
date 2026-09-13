export type DivisionId = "d1" | "d2" | "naia";
export type SubdivisionId = "all" | "fbs" | "fcs";
export type Classification = "FBS" | "FCS" | "D2" | "D3" | "NAIA";
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
  linescores: Array<number | null>;
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
  subdivision: Classification;
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

export type TeamProfile = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  nickname: string | null;
  location: string | null;
  color: string | null;
  altColor: string | null;
  logo: string;
  record: string | null;
  standingSummary: string | null;
  conferenceId: string | null;
  conferenceName: string | null;
  subdivision: Classification | null;
};

export type TeamScheduleGame = {
  id: string;
  date: string;
  week: number | null;
  name: string;
  shortName: string;
  status: GameSummary["status"];
  venue: string | null;
  broadcast: string | null;
  homeAway: "home" | "away" | "neutral";
  opponent: {
    id: string;
    name: string;
    shortName: string;
    abbreviation: string;
    logo: string;
  };
  teamScore: number | null;
  opponentScore: number | null;
  winner: boolean | null;
};

export type RosterPlayer = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  group: string;
  year: string | null;
  hometown: string | null;
  height: string | null;
  weight: string | null;
};

export type TeamCoach = {
  id: string;
  name: string;
};

export type TeamFeedStatus = "ok" | "error";

export type TeamDetailResponse = {
  source: "espn";
  demo: false;
  generatedAt: string;
  team: TeamProfile;
  recent: TeamScheduleGame[];
  upcoming: TeamScheduleGame[];
  roster: RosterPlayer[];
  coach: TeamCoach | null;
  coverage: {
    schedule: CoverageNote;
    roster: CoverageNote;
  };
};
