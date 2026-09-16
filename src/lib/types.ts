export type DivisionId = "d1" | "d2" | "naia";
export type SubdivisionId = "all" | "fbs" | "fcs";
export type Classification =
  | "FBS"
  | "FCS"
  | "D1"
  | "D2"
  | "D3"
  | "NAIA"
  | "NFL"
  | "AFC"
  | "NFC"
  | "NBA"
  | "MLB";
export type GameState = "pre" | "in" | "post";
export type StatusFilter = "all" | "live" | "final" | "upcoming";
/** Harmon Line sport instance. CFB is default; MBB, NFL, NBA, and MLB ship via the sport switcher. */
export type LeagueId = "cfb" | "mbb" | "nba" | "nfl" | "mlb";

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

export type ScoreboardView = "date" | "week";

export type ScoreboardWeek = {
  number: number;
  label: string;
  detail: string;
  startEspnDate: string;
  seasonType: number;
};

export type ScoreboardResponse = {
  source: "espn";
  demo: false;
  league: LeagueId;
  date: string;
  division: DivisionId;
  week: number | null;
  seasonYear: number | null;
  seasonType: number | null;
  weeks: ScoreboardWeek[];
  view: ScoreboardView;
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

export type TeamProfile = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  color: string | null;
  altColor: string | null;
  logo: string;
  record: string | null;
  standing: string | null;
  conferenceId: string | null;
  conferenceName: string | null;
  rank: number | null;
  subdivision: Classification | null;
};

export type TeamScheduleGame = {
  id: string;
  date: string;
  week: number | null;
  state: GameState;
  shortDetail: string;
  venue: string | null;
  broadcast: string | null;
  homeAway: "home" | "away";
  opponent: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string;
  };
  teamScore: number | null;
  opponentScore: number | null;
  result: "W" | "L" | "T" | null;
};

export type TeamRosterPlayer = {
  id: string;
  name: string;
  jersey: string | null;
  position: string;
  positionGroup: string;
  classYear: string | null;
  height: string | null;
  weight: string | null;
};

export type TeamPageResponse = {
  source: "espn";
  demo: false;
  league: LeagueId;
  generatedAt: string;
  team: TeamProfile;
  recent: TeamScheduleGame[];
  upcoming: TeamScheduleGame[];
  roster: TeamRosterPlayer[];
  coach: string | null;
  coverage: {
    schedule: CoverageNote;
    roster: CoverageNote;
  };
};

export type PollId = "ap" | "coaches" | "fcs" | "d2" | "d3";

export type RankTrend = {
  direction: "up" | "down" | "even" | null;
  label: string | null;
};

export type RankedTeam = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string | null;
};

export type RankingRow = {
  rank: number;
  previous: number | null;
  points: number | null;
  record: string | null;
  trend: RankTrend;
  team: RankedTeam;
};

export type RankingPoll = {
  id: PollId;
  espnId: string | null;
  name: string;
  shortName: string;
  headline: string;
  week: number | null;
  occurrence: string | null;
  ranks: RankingRow[];
};

export type RankingsResponse = {
  source: "espn";
  demo: false;
  league: LeagueId;
  generatedAt: string;
  week: number | null;
  seasonYear: number | null;
  poll: PollId;
  polls: RankingPoll[];
  selected: RankingPoll | null;
  coverage: CoverageNote;
};

export type TeamBoxStatLine = {
  name: string;
  label: string;
  displayValue: string;
};

export type TeamBoxStats = {
  teamId: string;
  teamName: string;
  abbreviation: string;
  homeAway: "home" | "away";
  statistics: TeamBoxStatLine[];
};

export type PlayerBoxAthlete = {
  id: string | null;
  name: string;
  jersey: string | null;
  stats: string[];
};

export type PlayerBoxCategory = {
  name: string;
  text: string;
  labels: string[];
  athletes: PlayerBoxAthlete[];
  totals: string[] | null;
};

export type PlayerBoxTeam = {
  teamId: string;
  teamName: string;
  abbreviation: string;
  categories: PlayerBoxCategory[];
};

export type PlayerBoxscore = {
  available: boolean;
  teams: PlayerBoxTeam[];
};

export type StandingsSnippetEntry = {
  id: string;
  name: string;
  overall: string | null;
  conference: string | null;
};

export type StandingsSnippetGroup = {
  header: string | null;
  entries: StandingsSnippetEntry[];
};

export type StandingsSnippet = {
  header: string | null;
  fullViewLink: { text: string; href: string } | null;
  groups: StandingsSnippetGroup[];
};

export type GamecastArticle = {
  type: string | null;
  headline: string;
  href: string | null;
};

export type GamecastNewsItem = {
  headline: string;
  href: string;
  type: string | null;
};

export type GamecastNews = {
  article: GamecastArticle | null;
  articles: GamecastNewsItem[];
};

export type GameDetailResponse = {
  source: "espn";
  demo: false;
  league: LeagueId;
  generatedAt: string;
  game: GameSummary;
  scoringPlays: ScoringPlay[];
  drives: Drive[];
  plays: PlayByPlayPlay[];
  leaders: LeaderLine[];
  playByPlayAvailable: boolean;
  coverage: CoverageNote;
  teamStats: TeamBoxStats[];
  playerBox: PlayerBoxscore;
  standings: StandingsSnippet | null;
  news: GamecastNews;
};

export type TeamSeasonStats = {
  available: boolean;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  pointsTotal: number | null;
  pointsAllowedPerGame: number | null;
  passingYardsPerGame: number | null;
  rushingYardsPerGame: number | null;
  yardsPerRush: number | null;
  yardsPerPass: number | null;
  completionPct: number | null;
  thirdDownPct: number | null;
  turnoverDifferential: number | null;
  giveaways: number | null;
  takeaways: number | null;
  rushingTouchdowns: number | null;
  passingTouchdowns: number | null;
  totalTouchdowns: number | null;
  interceptionsThrown: number | null;
  sacks: number | null;
  fieldGoalsMade: number | null;
  fieldGoalAttempts: number | null;
  rushingYardsAllowedPerGame: number | null;
  passingYardsAllowedPerGame: number | null;
};

export type ScheduleScoring = {
  games: number;
  pointsPerGame: number | null;
  pointsAllowedPerGame: number | null;
};

export type PublishedMarket = {
  provider: string;
  details: string | null;
  overUnder: number | null;
  spread: number | null;
  homeMoneyLine: number | null;
  awayMoneyLine: number | null;
};

export type SimHistogramBin = {
  start: number;
  end: number;
  count: number;
  pct: number;
};

export type PropConfidence = "HIGH" | "MEDIUM" | "LOW";

export type GameSimulation = {
  label: "SIMULATION";
  trials: number;
  seed: number;
  homeWinPct: number;
  awayWinPct: number;
  tiePct: number;
  meanMargin: number;
  marginLow: number;
  marginHigh: number;
  meanTotal: number;
  totalLow: number;
  totalHigh: number;
  sigmaMargin: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  confidence: PropConfidence;
  histogram: SimHistogramBin[];
  assumptions: string[];
  inputsUsed: string[];
  inputsMissing: string[];
};

export type HarmonLineMarket = "spread" | "total" | "ML" | "player_prop";
export type PropMarketKind = HarmonLineMarket;

export type HarmonLinePropCard = {
  id: string;
  game: { id: string; name: string };
  market: HarmonLineMarket;
  title: string;
  lean: string;
  why: string;
  fair_line: number | null;
  fair_prob: number | null;
  edge_vs_market: number | null;
  evidence: string[];
  inference: string[];
  confidence: PropConfidence;
  disclaimers: string[];
  data_as_of: string;
  model_version: string;
  basis: "team-stats" | "published-leaders" | "simulation" | "published-market";
  playerName: string | null;
  oddsAvailable: { line: string; provider: string } | null;
};

/** @deprecated use HarmonLinePropCard — kept as an alias for existing imports */
export type PropAngle = HarmonLinePropCard;

export type MatchupAnalysis = {
  markedAs: "ANALYSIS";
  headline: string;
  paragraphs: string[];
};

export type LayeredNote = {
  kind: "evidence" | "inference";
  text: string;
};

export type DeepDiveResponse = {
  source: "espn";
  demo: false;
  generatedAt: string;
  modelVersion: string;
  game: GameSummary;
  homeStats: TeamSeasonStats;
  awayStats: TeamSeasonStats;
  market: PublishedMarket | null;
  simulation: GameSimulation;
  analysis: MatchupAnalysis;
  props: HarmonLinePropCard[];
  evidence: string[];
  inference: string[];
  coverage: {
    stats: CoverageNote;
    market: CoverageNote;
    players: CoverageNote;
    cfbd: CoverageNote;
    odds: CoverageNote;
  };
  disclaimer: string;
  disclaimerLong: string;
};

export type OracleIntent =
  | "score"
  | "winner"
  | "record"
  | "rank"
  | "leaders"
  | "situation"
  | "schedule"
  | "stats"
  | "comparison"
  | "betting"
  | "general";

export type OracleEvidenceItem = {
  kind: "observed";
  text: string;
  field?: string;
};

export type OracleInferenceItem = {
  kind: "model";
  badge: "INFERENCE" | "SIMULATION";
  text: string;
};

export type OracleGrounding = {
  gameId: string | null;
  teamId: string | null;
  endpoints: string[];
};

export type OracleAnswer = {
  headline: string;
  summary: string;
};

export type OracleResponse = {
  source: "espn" | "espn+cfbd";
  demo: false;
  generatedAt: string;
  modelVersion: string;
  question: string;
  league: LeagueId;
  empty: boolean;
  grounded: OracleGrounding;
  honesty: CoverageNote;
  answer: OracleAnswer;
  evidence: OracleEvidenceItem[];
  inference: OracleInferenceItem[];
  coverage: CoverageNote;
  disclaimer: string | null;
  disclaimerLong: string | null;
};
