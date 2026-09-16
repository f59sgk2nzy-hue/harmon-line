import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NEWS_ARTICLE_LIMIT,
  parseGamecastDepth,
  parsePlayerBoxscore,
  parseStandingsSnippet,
  parseTeamBoxStats,
} from "./espn-gamecast";

const TEAM_STATS_PAYLOAD = {
  teams: [
    {
      homeAway: "away",
      team: {
        id: "150",
        displayName: "Duke Blue Devils",
        abbreviation: "DUKE",
      },
      statistics: [
        { name: "firstDowns", displayValue: "19", value: 19, label: "1st Downs" },
        {
          name: "thirdDownEff",
          displayValue: "2-9",
          value: 0.2222222222,
          label: "3rd down efficiency",
        },
        { name: "totalYards", displayValue: "376", label: "Total Yards" },
      ],
    },
    {
      homeAway: "home",
      team: {
        id: "356",
        displayName: "Illinois Fighting Illini",
        abbreviation: "ILL",
      },
      statistics: [
        { name: "firstDowns", displayValue: "23", value: 23, label: "1st Downs" },
        {
          name: "thirdDownEff",
          displayValue: "5-12",
          value: 0.4166666667,
          label: "3rd down efficiency",
        },
        { name: "totalYards", displayValue: "382", label: "Total Yards" },
      ],
    },
  ],
};

const PLAYER_BOX_PAYLOAD = {
  teams: TEAM_STATS_PAYLOAD.teams,
  players: [
    {
      team: { id: "150", displayName: "Duke Blue Devils", abbreviation: "DUKE" },
      statistics: [
        {
          name: "passing",
          text: "Duke Passing",
          labels: ["C/ATT", "YDS", "AVG", "TD", "INT", "QBR"],
          athletes: [
            {
              athlete: { id: "4694149", displayName: "Walker Eget", jersey: "2" },
              stats: ["15/21", "206", "9.8", "3", "0", "75.9"],
            },
          ],
          totals: ["15/22", "206", "9.4", "3", "0", "--"],
        },
        {
          name: "puntReturns",
          text: "Duke Punt Returns",
          labels: ["NO", "YDS", "AVG", "LONG", "TD"],
          athletes: [],
          totals: [],
        },
      ],
    },
  ],
};

const STANDINGS_PAYLOAD = {
  fullViewLink: {
    text: "Full Standings",
    href: "https://www.espn.com/college-football/standings",
  },
  header: "2026 Standings",
  groups: [
    {
      header: "2026 Atlantic Coast Conference Standings",
      standings: {
        entries: [
          {
            team: "Miami",
            id: "2390",
            stats: [
              { name: "overall", type: "total", displayValue: "2-0", summary: "2-0" },
              { name: "vs. Conf.", type: "vsconf", displayValue: "1-0", summary: "1-0" },
            ],
          },
          {
            team: { displayName: "Duke Blue Devils", location: "Duke" },
            id: "150",
            stats: [{ name: "overall", type: "total", displayValue: "2-0" }],
          },
          {
            team: "Ghost",
            id: "9999",
            stats: [],
          },
        ],
      },
    },
  ],
};

describe("parseTeamBoxStats", () => {
  it("copies ESPN name/label and displayValue and never uses the numeric value field", () => {
    const teams = parseTeamBoxStats(TEAM_STATS_PAYLOAD);
    assert.equal(teams.length, 2);
    const duke = teams.find((row) => row.teamId === "150");
    assert.ok(duke);
    assert.equal(duke.homeAway, "away");
    assert.equal(duke.abbreviation, "DUKE");
    const third = duke.statistics.find((row) => row.name === "thirdDownEff");
    assert.deepEqual(third, {
      name: "thirdDownEff",
      label: "3rd down efficiency",
      displayValue: "2-9",
    });
    assert.equal(
      duke.statistics.some((row) => String(row.displayValue).includes("0.22")),
      false
    );
  });

  it("returns an empty list when boxscore teams have no statistics", () => {
    assert.deepEqual(parseTeamBoxStats({ teams: [{ team: { id: "1" } }] }), []);
    assert.deepEqual(parseTeamBoxStats(undefined), []);
    assert.deepEqual(parseTeamBoxStats({ teams: [] }), []);
  });

  it("drops a stat row that is missing displayValue instead of inventing yards", () => {
    const teams = parseTeamBoxStats({
      teams: [
        {
          homeAway: "home",
          team: { id: "333", abbreviation: "ALA", displayName: "Alabama" },
          statistics: [
            { name: "totalYards", label: "Total Yards" },
            { name: "firstDowns", label: "1st Downs", displayValue: "21" },
          ],
        },
      ],
    });
    assert.equal(teams[0]?.statistics.length, 1);
    assert.equal(teams[0]?.statistics[0]?.name, "firstDowns");
    assert.equal(teams[0]?.statistics[0]?.displayValue, "21");
  });
});

describe("parsePlayerBoxscore", () => {
  it("builds category tables from ESPN labels plus athlete rows", () => {
    const box = parsePlayerBoxscore(PLAYER_BOX_PAYLOAD);
    assert.equal(box.available, true);
    assert.equal(box.teams.length, 1);
    assert.equal(box.teams[0]?.categories.length, 1);
    const passing = box.teams[0]?.categories[0];
    assert.equal(passing?.name, "passing");
    assert.equal(passing?.text, "Duke Passing");
    assert.deepEqual(passing?.labels, ["C/ATT", "YDS", "AVG", "TD", "INT", "QBR"]);
    assert.equal(passing?.athletes[0]?.name, "Walker Eget");
    assert.equal(passing?.athletes[0]?.jersey, "2");
    assert.deepEqual(passing?.athletes[0]?.stats, ["15/21", "206", "9.8", "3", "0", "75.9"]);
    assert.deepEqual(passing?.totals, ["15/22", "206", "9.4", "3", "0", "--"]);
  });

  it("marks the player box unavailable when ESPN omitted boxscore.players", () => {
    const missing = parsePlayerBoxscore({ teams: TEAM_STATS_PAYLOAD.teams });
    assert.deepEqual(missing, { available: false, teams: [] });
    assert.deepEqual(parsePlayerBoxscore(undefined), { available: false, teams: [] });
  });
});

describe("parseStandingsSnippet", () => {
  it("links teams by entry.id even when team is a string and copies published records only", () => {
    const snippet = parseStandingsSnippet(STANDINGS_PAYLOAD);
    assert.ok(snippet);
    assert.equal(snippet.header, "2026 Standings");
    assert.deepEqual(snippet.fullViewLink, {
      text: "Full Standings",
      href: "https://www.espn.com/college-football/standings",
    });
    const group = snippet.groups[0];
    assert.equal(group?.header, "2026 Atlantic Coast Conference Standings");
    assert.equal(group?.entries[0]?.id, "2390");
    assert.equal(group?.entries[0]?.name, "Miami");
    assert.equal(group?.entries[0]?.overall, "2-0");
    assert.equal(group?.entries[0]?.conference, "1-0");
    assert.equal(group?.entries[1]?.name, "Duke Blue Devils");
    assert.equal(group?.entries[1]?.overall, "2-0");
    assert.equal(group?.entries[1]?.conference, null);
    assert.equal(group?.entries[2]?.overall, null);
    assert.equal(group?.entries[2]?.conference, null);
  });

  it("returns null when standings groups are missing", () => {
    assert.equal(parseStandingsSnippet(undefined), null);
    assert.equal(parseStandingsSnippet({ header: "2026 Standings" }), null);
  });
});

describe("parseGamecastDepth", () => {
  it("surfaces Preview/Recap headline plus capped espn.com and video article links", () => {
    const depth = parseGamecastDepth({
      boxscore: TEAM_STATS_PAYLOAD,
      standings: STANDINGS_PAYLOAD,
      article: {
        type: "Recap",
        headline: "Duke rallies to beat Illinois",
        links: { web: { href: "http://www.espn.com/ncf/recap?gameId=401858217" } },
      },
      news: {
        articles: [
          {
            type: "Media",
            headline: "Clip from the booth",
            links: {
              web: { href: "https://www.espn.com/video/clip/_/id/49953740/clip" },
            },
          },
          {
            type: "Story",
            headline: "Off-network gossip",
            links: { web: { href: "https://example.com/not-espn" } },
          },
          {
            headline: "SportsCenter deep link",
            links: { web: { href: "sportscenter://x-callback-url/showVideo?videoID=1" } },
          },
        ],
      },
      odds: { details: "-3.5" },
      pickcenter: [{ spread: -7 }],
      winprobability: [{ homeWinPercentage: 0.61 }],
      againstTheSpread: [{ records: [] }],
      predictor: { homeTeam: { gameProjection: 28 } },
    });

    assert.equal(depth.teamStats.length, 2);
    assert.equal(depth.playerBox.available, false);
    assert.equal(depth.standings?.groups[0]?.entries[0]?.id, "2390");
    assert.equal(depth.news.article?.type, "Recap");
    assert.equal(depth.news.article?.headline, "Duke rallies to beat Illinois");
    assert.equal(
      depth.news.article?.href,
      "http://www.espn.com/ncf/recap?gameId=401858217"
    );
    assert.equal(depth.news.articles.length, 1);
    assert.equal(depth.news.articles[0]?.href.includes("espn.com/video"), true);
    assert.equal(
      JSON.stringify(depth).includes("homeWinPercentage") ||
        JSON.stringify(depth).includes("gameProjection") ||
        JSON.stringify(depth).includes("-3.5"),
      false
    );
  });

  it("caps news.articles at NEWS_ARTICLE_LIMIT and keeps empty modules honest", () => {
    const articles = Array.from({ length: NEWS_ARTICLE_LIMIT + 4 }, (_, index) => ({
      headline: `Story ${index}`,
      links: { web: { href: `https://www.espn.com/college-football/story/_/id/${index}` } },
    }));
    const depth = parseGamecastDepth({
      news: { articles },
    });
    assert.equal(depth.news.articles.length, NEWS_ARTICLE_LIMIT);
    assert.equal(depth.teamStats.length, 0);
    assert.equal(depth.playerBox.available, false);
    assert.equal(depth.standings, null);
    assert.equal(depth.news.article, null);
  });
});
