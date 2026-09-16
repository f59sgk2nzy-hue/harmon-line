import { DEFAULT_LEAGUE } from "./leagues";
import type { Classification, ConferenceOption, CoverageNote, DivisionId, LeagueId, SubdivisionId } from "./types";

export const MBB_D1_GROUP = "50";
export const MBB_SCOREBOARD_LIMIT = 400;

/** ESPN NFL standings children (probed 2026-09-16): AFC=8, NFC=7. */
export const NFL_AFC_GROUP = "8";
export const NFL_NFC_GROUP = "7";

export const NFL_CONFERENCE_NAMES: Record<string, ConferenceOption> = {
  [NFL_AFC_GROUP]: { id: NFL_AFC_GROUP, name: "AFC", abbreviation: "AFC" },
  [NFL_NFC_GROUP]: { id: NFL_NFC_GROUP, name: "NFC", abbreviation: "NFC" },
};

/** ESPN team id → standings conference id. Not invented scores — classification only. */
export const NFL_TEAM_CONFERENCE: Record<string, typeof NFL_AFC_GROUP | typeof NFL_NFC_GROUP> = {
  "1": NFL_NFC_GROUP,
  "2": NFL_AFC_GROUP,
  "3": NFL_NFC_GROUP,
  "4": NFL_AFC_GROUP,
  "5": NFL_AFC_GROUP,
  "6": NFL_NFC_GROUP,
  "7": NFL_AFC_GROUP,
  "8": NFL_NFC_GROUP,
  "9": NFL_NFC_GROUP,
  "10": NFL_AFC_GROUP,
  "11": NFL_AFC_GROUP,
  "12": NFL_AFC_GROUP,
  "13": NFL_AFC_GROUP,
  "14": NFL_NFC_GROUP,
  "15": NFL_AFC_GROUP,
  "16": NFL_NFC_GROUP,
  "17": NFL_AFC_GROUP,
  "18": NFL_NFC_GROUP,
  "19": NFL_NFC_GROUP,
  "20": NFL_AFC_GROUP,
  "21": NFL_NFC_GROUP,
  "22": NFL_NFC_GROUP,
  "23": NFL_AFC_GROUP,
  "24": NFL_AFC_GROUP,
  "25": NFL_NFC_GROUP,
  "26": NFL_NFC_GROUP,
  "27": NFL_NFC_GROUP,
  "28": NFL_NFC_GROUP,
  "29": NFL_NFC_GROUP,
  "30": NFL_AFC_GROUP,
  "33": NFL_AFC_GROUP,
  "34": NFL_AFC_GROUP,
};

export function nflConferenceForTeam(teamId: string | null | undefined): ConferenceOption | null {
  if (!teamId) return null;
  const conferenceId = NFL_TEAM_CONFERENCE[teamId];
  return conferenceId ? NFL_CONFERENCE_NAMES[conferenceId] ?? null : null;
}

/** ESPN college-football group IDs for the 2026 season. */
export const DIVISION_GROUPS: Record<
  DivisionId,
  { groups: string[]; label: string; short: string }
> = {
  d1: { groups: ["80", "81"], label: "NCAA Division I", short: "D1" },
  d2: { groups: ["57"], label: "NCAA Division II", short: "D2" },
  naia: { groups: ["186"], label: "NAIA", short: "NAIA" },
};

export const SUBDIVISION_GROUP: Record<"fbs" | "fcs", string> = {
  fbs: "80",
  fcs: "81",
};

export const CONFERENCE_NAMES: Record<string, ConferenceOption> = {
  "1": { id: "1", name: "ACC", abbreviation: "ACC" },
  "4": { id: "4", name: "Big 12", abbreviation: "Big 12" },
  "5": { id: "5", name: "Big Ten", abbreviation: "B1G" },
  "8": { id: "8", name: "SEC", abbreviation: "SEC" },
  "9": { id: "9", name: "Pac-12", abbreviation: "Pac-12" },
  "12": { id: "12", name: "Conference USA", abbreviation: "CUSA" },
  "15": { id: "15", name: "MAC", abbreviation: "MAC" },
  "17": { id: "17", name: "Mountain West", abbreviation: "MW" },
  "18": { id: "18", name: "FBS Independents", abbreviation: "IND" },
  "20": { id: "20", name: "Big Sky", abbreviation: "Big Sky" },
  "21": { id: "21", name: "Missouri Valley", abbreviation: "MVFC" },
  "22": { id: "22", name: "Ivy League", abbreviation: "Ivy" },
  "24": { id: "24", name: "MEAC", abbreviation: "MEAC" },
  "25": { id: "25", name: "Northeast", abbreviation: "NEC" },
  "27": { id: "27", name: "Patriot League", abbreviation: "Patriot" },
  "28": { id: "28", name: "Pioneer", abbreviation: "PFL" },
  "29": { id: "29", name: "Southern", abbreviation: "SoCon" },
  "30": { id: "30", name: "Southland", abbreviation: "SLC" },
  "31": { id: "31", name: "SWAC", abbreviation: "SWAC" },
  "32": { id: "32", name: "FCS Independents", abbreviation: "IND" },
  "37": { id: "37", name: "Sun Belt", abbreviation: "SBC" },
  "48": { id: "48", name: "CAA", abbreviation: "CAA" },
  "151": { id: "151", name: "American", abbreviation: "AAC" },
  "177": { id: "177", name: "United Athletic", abbreviation: "UAC" },
  "179": { id: "179", name: "Ohio Valley", abbreviation: "OVC" },
  "104": { id: "104", name: "CIAA", abbreviation: "CIAA" },
  "107": { id: "107", name: "GLIAC", abbreviation: "GLIAC" },
  "108": { id: "108", name: "Great Lakes", abbreviation: "GLVC" },
  "110": { id: "110", name: "Gulf South", abbreviation: "GSC" },
  "112": { id: "112", name: "Independent DII", abbreviation: "IND" },
  "116": { id: "116", name: "Lone Star", abbreviation: "LSC" },
  "118": { id: "118", name: "Mid-America", abbreviation: "MIAA" },
  "127": { id: "127", name: "Northeast-10", abbreviation: "NE10" },
  "129": { id: "129", name: "Northern Sun", abbreviation: "NSIC" },
  "133": { id: "133", name: "PSAC", abbreviation: "PSAC" },
  "135": { id: "135", name: "Rocky Mountain", abbreviation: "RMAC" },
  "136": { id: "136", name: "SIAC", abbreviation: "SIAC" },
  "139": { id: "139", name: "South Atlantic", abbreviation: "SAC" },
  "144": { id: "144", name: "Mountain East", abbreviation: "MEC" },
  "146": { id: "146", name: "Great American", abbreviation: "GAC" },
  "165": { id: "165", name: "G-MAC", abbreviation: "G-MAC" },
  "187": { id: "187", name: "Conference Carolinas", abbreviation: "CC" },
  "186": { id: "186", name: "NAIA", abbreviation: "NAIA" },
};

/** Conference / independent group ids → board classification. */
export const CONFERENCE_SUBDIVISION: Record<string, Classification> = {
  "1": "FBS",
  "4": "FBS",
  "5": "FBS",
  "8": "FBS",
  "9": "FBS",
  "12": "FBS",
  "15": "FBS",
  "17": "FBS",
  "18": "FBS",
  "37": "FBS",
  "151": "FBS",
  "20": "FCS",
  "21": "FCS",
  "22": "FCS",
  "24": "FCS",
  "25": "FCS",
  "27": "FCS",
  "28": "FCS",
  "29": "FCS",
  "30": "FCS",
  "31": "FCS",
  "32": "FCS",
  "48": "FCS",
  "177": "FCS",
  "179": "FCS",
  "104": "D2",
  "107": "D2",
  "108": "D2",
  "110": "D2",
  "112": "D2",
  "116": "D2",
  "118": "D2",
  "127": "D2",
  "129": "D2",
  "133": "D2",
  "135": "D2",
  "136": "D2",
  "139": "D2",
  "144": "D2",
  "146": "D2",
  "165": "D2",
  "187": "D2",
  "186": "NAIA",
};

export const MBB_CONFERENCE_NAMES: Record<string, ConferenceOption> = {
  "1": { id: "1", name: "America East", abbreviation: "AE" },
  "2": { id: "2", name: "ACC", abbreviation: "ACC" },
  "3": { id: "3", name: "Atlantic 10", abbreviation: "A-10" },
  "4": { id: "4", name: "Big East", abbreviation: "BE" },
  "5": { id: "5", name: "Big Sky", abbreviation: "Big Sky" },
  "6": { id: "6", name: "Big South", abbreviation: "Big South" },
  "7": { id: "7", name: "Big Ten", abbreviation: "B1G" },
  "8": { id: "8", name: "Big 12", abbreviation: "Big 12" },
  "9": { id: "9", name: "Big West", abbreviation: "Big West" },
  "10": { id: "10", name: "CAA", abbreviation: "CAA" },
  "11": { id: "11", name: "Conference USA", abbreviation: "CUSA" },
  "12": { id: "12", name: "Ivy League", abbreviation: "Ivy" },
  "13": { id: "13", name: "MAAC", abbreviation: "MAAC" },
  "14": { id: "14", name: "MAC", abbreviation: "MAC" },
  "16": { id: "16", name: "MEAC", abbreviation: "MEAC" },
  "18": { id: "18", name: "Missouri Valley", abbreviation: "MVC" },
  "19": { id: "19", name: "Northeast", abbreviation: "NEC" },
  "20": { id: "20", name: "Ohio Valley", abbreviation: "OVC" },
  "22": { id: "22", name: "Patriot League", abbreviation: "Patriot" },
  "23": { id: "23", name: "SEC", abbreviation: "SEC" },
  "24": { id: "24", name: "Southern", abbreviation: "SoCon" },
  "25": { id: "25", name: "Southland", abbreviation: "SLC" },
  "26": { id: "26", name: "SWAC", abbreviation: "SWAC" },
  "27": { id: "27", name: "Sun Belt", abbreviation: "SBC" },
  "29": { id: "29", name: "West Coast", abbreviation: "WCC" },
  "30": { id: "30", name: "United Athletic", abbreviation: "UAC" },
  "44": { id: "44", name: "Mountain West", abbreviation: "MW" },
  "45": { id: "45", name: "Horizon", abbreviation: "Horizon" },
  "46": { id: "46", name: "Atlantic Sun", abbreviation: "ASUN" },
  "49": { id: "49", name: "Summit League", abbreviation: "Summit" },
  "62": { id: "62", name: "American", abbreviation: "AAC" },
};

export function scoreboardGroups(
  league: LeagueId,
  division: DivisionId,
  subdivision?: SubdivisionId
): string[] {
  if (league === "nfl") return [];
  if (league === "mbb") return [MBB_D1_GROUP];
  if (division === "d1" && subdivision && subdivision !== "all") {
    return [subdivision === "fbs" ? "80" : "81"];
  }
  return DIVISION_GROUPS[division].groups;
}

function conferenceTable(league: LeagueId): Record<string, ConferenceOption> {
  if (league === "mbb") return MBB_CONFERENCE_NAMES;
  if (league === "nfl") return NFL_CONFERENCE_NAMES;
  return CONFERENCE_NAMES;
}

export function conferenceLabel(
  id: string | null | undefined,
  league: LeagueId = DEFAULT_LEAGUE
): string | null {
  if (!id) return null;
  return conferenceTable(league)[id]?.name ?? `Conference ${id}`;
}

export function coverageFor(
  division: DivisionId,
  league: LeagueId = DEFAULT_LEAGUE,
  meta?: { gameCount?: number; limit?: number }
): CoverageNote {
  if (league === "nfl") {
    const gameCount = meta?.gameCount ?? 0;
    const empty =
      gameCount === 0
        ? " Empty weeks are labeled empty — scores are never invented."
        : "";
    return {
      headline: "NFL — ESPN public 32-team scoreboard",
      detail: `32-team National Football League from ESPN’s unofficial football/nfl scoreboard (no college D1/D2/NAIA groups). Week nav uses week/year/seasontype. Preseason and postseason chips appear only when ESPN’s calendar published them. Rankings 404 on this feed and are not shown. Scores are never invented.${empty}`,
    };
  }
  if (league === "mbb") {
    const gameCount = meta?.gameCount ?? 0;
    const limit = meta?.limit ?? MBB_SCOREBOARD_LIMIT;
    const truncated =
      gameCount >= limit
        ? " This response hit the ESPN event limit; the published slate may be truncated."
        : "";
    const empty =
      gameCount === 0
        ? " September slates are often empty out of season."
        : "";
    return {
      headline: "Division I men’s basketball — ESPN public scoreboard",
      detail: `NCAA D1 (ESPN group 50) from ESPN’s unofficial public site API. Date nav uses dates=YYYYMMDD, not football week chips. D2/NAIA basketball is not on this board. Scores are never invented.${empty}${truncated}`,
    };
  }
  if (division === "d1") {
    return {
      headline: "Division I — ESPN public scoreboard",
      detail:
        "FBS (group 80) and FCS (group 81) from ESPN’s unofficial public site API. Play-by-play is published for most nationally covered games; some FCS contests have scores only.",
    };
  }
  if (division === "d2") {
    return {
      headline: "Division II — ESPN group 57",
      detail:
        "Scores and schedules come from ESPN’s NCAA Division II group. Play-by-play is available on a minority of games; the rest are labeled as scores-only.",
    };
  }
  return {
    headline: "NAIA — ESPN group 186 (partial)",
    detail:
      "ESPN lists NAIA programs under group 186, mostly crossover games vs NCAA schools. Many NAIA-vs-NAIA Saturday slates never hit this feed. Play-by-play is rarely published. PrestoSports / NAIA Stats is behind Cloudflare and is not used.",
  };
}
