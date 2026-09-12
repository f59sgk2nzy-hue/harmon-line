import type { ConferenceOption, DivisionId } from "@/lib/types";

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

export function conferenceLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return CONFERENCE_NAMES[id]?.name ?? `Conference ${id}`;
}

export function coverageFor(division: DivisionId): {
  headline: string;
  detail: string;
} {
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
