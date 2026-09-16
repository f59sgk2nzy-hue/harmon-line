import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardHref, gameHref, sportBoardHref, sportRankingsHref } from "./board-url";
import { conferenceLabel, coverageFor, scoreboardGroups } from "./conferences";
import { parseGamecastDepth, parsePlayerBoxscore, parseTeamBoxStats } from "./espn-gamecast";
import { assembleRankingsPage, pollTabsFor } from "./espn-rankings";
import { parseTeamProfile, teamHref } from "./espn-team";
import { espnScoreboardPath } from "./espn-weeks";
import { parseLinescores, periodLabel, periodSportFor, playPeriodLabel } from "./espn-parse";
import { teamLogoUrl } from "./espn-path";
import { parseAtBats, parsePlays, parseScoringPlays } from "./espn-plays";
import { favoriteKey } from "./leagues";

describe("scoreboardGroups MLB", () => {
  it("does not send college D1/D2/NAIA or MBB group 50 on the MLB board", () => {
    assert.deepEqual(scoreboardGroups("mlb", "d1"), []);
    assert.deepEqual(scoreboardGroups("mlb", "d2", "fbs"), []);
    assert.deepEqual(scoreboardGroups("mlb", "naia"), []);
    assert.deepEqual(scoreboardGroups("nba", "d1"), []);
    assert.deepEqual(scoreboardGroups("mbb", "d1"), ["50"]);
    assert.deepEqual(scoreboardGroups("cfb", "d1", "all"), ["80", "81"]);
  });
});

describe("MLB coverage copy", () => {
  it("names the ESPN baseball/mlb date board and stays honest on an empty night", () => {
    const note = coverageFor("d1", "mlb", { gameCount: 0 });
    assert.match(note.headline, /mlb/i);
    assert.match(note.detail, /baseball\/mlb|mlb/i);
    assert.match(note.detail, /dates=YYYYMMDD|date/i);
    assert.match(note.detail, /never invent/i);
    assert.match(note.detail, /no college|no rankings|404/i);
    assert.doesNotMatch(note.detail, /group 50|Division I FBS|32-team/i);
    assert.doesNotMatch(note.headline, /not shipped/i);

    const cfb = coverageFor("d1");
    assert.match(cfb.headline, /Division I/);
    assert.doesNotMatch(cfb.detail, /mlb/i);
  });
});

describe("MLB period labels", () => {
  it("uses inning numbers, not football quarters or MBB halves", () => {
    assert.equal(periodSportFor("mlb"), "baseball");
    assert.equal(periodSportFor("nba"), "football");
    assert.equal(periodSportFor("mbb"), "basketball");
    assert.equal(periodLabel(0, periodSportFor("mlb")), "1");
    assert.equal(periodLabel(8, periodSportFor("mlb")), "9");
    assert.equal(periodLabel(9, periodSportFor("mlb")), "10");
    assert.equal(periodLabel(10, periodSportFor("mlb")), "11");
    assert.equal(playPeriodLabel(1, periodSportFor("mlb")), "1");
    assert.equal(playPeriodLabel(9, periodSportFor("mlb")), "9");
    assert.equal(playPeriodLabel(11, periodSportFor("mlb")), "11");
    assert.equal(periodLabel(0, periodSportFor("nba")), "Q1");
    assert.equal(periodLabel(0, periodSportFor("mbb")), "1H");
  });
});

describe("MLB linescores", () => {
  it("keeps every published inning including extras and does not invent a 10th", () => {
    const nine = parseLinescores([
      { value: 0, displayValue: "0", period: 1 },
      { value: 1, displayValue: "1", period: 2 },
      { value: 0, displayValue: "0", period: 3 },
      { value: 2, displayValue: "2", period: 4 },
      { value: 0, displayValue: "0", period: 5 },
      { value: 0, displayValue: "0", period: 6 },
      { value: 1, displayValue: "1", period: 7 },
      { value: 0, displayValue: "0", period: 8 },
      { value: 0, displayValue: "0", period: 9 },
    ]);
    assert.equal(nine.length, 9);
    assert.deepEqual(nine, [0, 1, 0, 2, 0, 0, 1, 0, 0]);

    const extras = parseLinescores([
      { displayValue: "0" },
      { displayValue: "1" },
      { displayValue: "0" },
      { displayValue: "0" },
      { displayValue: "2" },
      { displayValue: "0" },
      { displayValue: "0" },
      { displayValue: "1" },
      { displayValue: "0" },
      { displayValue: "0" },
      { displayValue: "3", hits: 2, errors: 0 },
    ]);
    assert.equal(extras.length, 11);
    assert.equal(extras[8], 0);
    assert.equal(extras[10], 3);
  });
});

describe("espnScoreboardPath MLB", () => {
  it("loads the MLB slate by Eastern date with no college groups or week chips", () => {
    assert.equal(
      espnScoreboardPath({
        date: "20260915",
        view: "date",
      }),
      "/scoreboard?dates=20260915&limit=300"
    );
    assert.equal(
      espnScoreboardPath({
        date: "20260916",
        view: "date",
        limit: 300,
      }),
      "/scoreboard?dates=20260916&limit=300"
    );
  });
});

describe("MLB hrefs", () => {
  it("scopes board, game, and team URLs with league=mlb and date, not week", () => {
    assert.equal(sportBoardHref("mlb"), "/?league=mlb");
    assert.equal(sportRankingsHref("mlb"), "/rankings?league=mlb");
    assert.equal(gameHref("401816943", "mlb"), "/game/401816943?league=mlb");
    assert.equal(teamHref("15", "mlb"), "/team/15?league=mlb");
    assert.equal(
      boardHref({
        division: "d1",
        date: "20260915",
        league: "mlb",
      }),
      "/?division=d1&date=20260915&league=mlb"
    );
    assert.doesNotMatch(
      boardHref({
        division: "d1",
        date: "20260915",
        week: 2,
        year: 2026,
        league: "mlb",
      }),
      /week=/
    );
  });
});

describe("MLB logos", () => {
  it("uses the mlb/500 CDN namespace with abbreviations, not ncaa", () => {
    assert.equal(
      teamLogoUrl("15", "mlb", "NYY"),
      "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png"
    );
    assert.equal(
      teamLogoUrl("2", "mlb", "BOS"),
      "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png"
    );
    assert.equal(
      teamLogoUrl("150", "mbb"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png"
    );
  });
});

describe("MLB rankings honesty", () => {
  it("exposes no poll tabs and does not invent an AP ballot", () => {
    assert.deepEqual(pollTabsFor("mlb"), []);
    const page = assembleRankingsPage({
      payload: { rankings: [{ id: "1", type: "ap", ranks: [{ current: 1, team: { id: "15" } }] }] },
      poll: "ap",
      league: "mlb",
    });
    assert.equal(page.demo, false);
    assert.equal(page.league, "mlb");
    assert.equal(page.polls.length, 0);
    assert.equal(page.selected, null);
    assert.match(page.coverage.detail, /not published|no rankings|404|does not publish|does not fabricate/i);
    assert.match(page.coverage.headline, /mlb|this league|no espn rankings/i);
    assert.doesNotMatch(page.coverage.detail, /sample|invent/i);
  });
});

describe("MLB team profile", () => {
  it("labels MLB from the league and uses the MLB logo CDN", () => {
    const team = parseTeamProfile(
      {
        team: {
          id: "15",
          displayName: "New York Yankees",
          abbreviation: "NYY",
        },
      },
      "mlb"
    );
    assert.equal(team.subdivision, "MLB");
    assert.equal(team.logo, "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png");
  });
});

describe("MLB conference names", () => {
  it("does not reuse CFB conference ids — unknown ids stay labeled, not SEC", () => {
    assert.equal(conferenceLabel("8", "cfb"), "SEC");
    assert.equal(conferenceLabel("8", "mlb"), "Conference 8");
  });
});

describe("favorites keys", () => {
  it("namespaces MLB team ids so Yankees 15 is not CFB 15", () => {
    assert.equal(favoriteKey("mlb", "15"), "mlb:15");
    assert.equal(favoriteKey("cfb", "15"), "cfb:15");
    assert.equal(favoriteKey("nba", "15"), "nba:15");
  });
});

describe("MLB plays and atBats", () => {
  it("reads published plays and scoring flags without inventing a feed", () => {
    const plays = parsePlays([
      {
        id: "p1",
        text: "Top of the 1st inning",
        scoringPlay: false,
        homeScore: 0,
        awayScore: 0,
        period: { type: "Top", number: 1, displayValue: "1st Inning" },
        type: { text: "Start Inning" },
      },
      {
        id: "p2",
        text: "Judge homered to left.",
        scoringPlay: true,
        homeScore: 0,
        awayScore: 1,
        period: { type: "Top", number: 1 },
        team: { id: "15", displayName: "Yankees" },
      },
      {
        id: "p3",
        type: { text: "End Batter/Pitcher" },
        homeScore: 0,
        awayScore: 1,
        period: { number: 1 },
      },
    ]);
    assert.equal(plays.length, 2);
    assert.equal(plays[0]?.period, 1);
    assert.equal(plays[1]?.scoringPlay, true);
    assert.deepEqual(parsePlays(undefined), []);
    assert.deepEqual(parsePlays([]), []);
  });

  it("resolves atBats $ref indexes into published plays and stays empty when omitted", () => {
    const rawPlays = [
      { id: "0", text: "Start at-bat", period: { number: 3, type: "Bottom" } },
      { id: "1", text: "Ball", period: { number: 3, type: "Bottom" } },
      { id: "2", type: { text: "End Batter/Pitcher" }, period: { number: 3 } },
      { id: "3", text: "Ground out", period: { number: 3, type: "Bottom" } },
    ];
    const groups = parseAtBats(
      {
        "4018169430301": [{ $ref: "#/plays/0" }, { $ref: "#/plays/1" }, { $ref: "#/plays/2" }],
        "4018169430302": [{ $ref: "#/plays/3" }],
      },
      rawPlays
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.id, "4018169430301");
    assert.equal(groups[0]?.plays.length, 2);
    assert.equal(groups[0]?.plays[0]?.text, "Start at-bat");
    assert.equal(groups[1]?.plays[0]?.text, "Ground out");
    assert.deepEqual(parseAtBats(undefined, rawPlays), []);
    assert.deepEqual(parseAtBats({}, rawPlays), []);
  });

  it("reads inline at-bat play lists when ESPN did not send $ref indexes", () => {
    const groups = parseAtBats(
      [
        {
          id: "ab1",
          plays: [{ id: "x", text: "Single to center", period: { number: 7 } }],
        },
      ],
      []
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.plays[0]?.text, "Single to center");
  });

  it("derives scoring from PBP flags when scoringPlays is absent", () => {
    const scoring = parseScoringPlays({
      plays: [
        {
          id: "s1",
          text: "Simpson scored on a passed ball.",
          scoringPlay: true,
          homeScore: 1,
          awayScore: 0,
          period: { number: 2 },
          team: { id: "30", displayName: "Rays" },
        },
        { id: "ns", text: "Strike looking", scoringPlay: false, period: { number: 2 } },
      ],
    });
    assert.equal(scoring.length, 1);
    assert.equal(scoring[0]?.text, "Simpson scored on a passed ball.");
    assert.equal(scoring[0]?.homeScore, 1);
    assert.equal(scoring[0]?.teamName, "Rays");
  });
});

describe("MLB boxscore nesting", () => {
  it("flattens nested batting/pitching team stats instead of dropping the box", () => {
    const teams = parseTeamBoxStats({
      teams: [
        {
          homeAway: "away",
          team: { id: "11", displayName: "Athletics", abbreviation: "ATH" },
          statistics: [
            {
              name: "batting",
              displayName: "Batting",
              stats: [
                { name: "gamesPlayed", abbreviation: "GP", displayValue: "1" },
                { name: "hits", abbreviation: "H", displayValue: "4" },
                { name: "runs", abbreviation: "R", displayValue: "1" },
              ],
            },
            {
              name: "pitching",
              displayName: "Pitching",
              stats: [{ name: "strikeouts", abbreviation: "K", displayValue: "10" }],
            },
          ],
        },
      ],
    });
    assert.equal(teams.length, 1);
    const names = teams[0]!.statistics.map((row) => row.name);
    assert.equal(names.includes("batting.hits"), true);
    assert.equal(names.includes("batting.runs"), true);
    assert.equal(names.includes("pitching.strikeouts"), true);
    assert.equal(names.includes("batting.gamesPlayed"), false);
    assert.equal(teams[0]!.statistics.find((row) => row.name === "batting.hits")?.displayValue, "4");
  });

  it("labels MLB player cats from type when name/text are omitted", () => {
    const box = parsePlayerBoxscore({
      players: [
        {
          team: { id: "30", displayName: "Tampa Bay Rays", abbreviation: "TB" },
          statistics: [
            {
              type: "batting",
              labels: ["H-AB", "R", "H"],
              names: ["H-AB", "R", "H"],
              athletes: [
                {
                  athlete: { id: "1", displayName: "Yandy Diaz" },
                  stats: ["0-4", "0", "0"],
                },
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "K"],
              names: ["IP", "K"],
              athletes: [
                {
                  athlete: { id: "2", displayName: "Griffin Jax" },
                  stats: ["5.0", "7"],
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(box.available, true);
    assert.deepEqual(
      box.teams[0]?.categories.map((cat) => cat.name),
      ["batting", "pitching"]
    );
  });
});

describe("MLB gamecast honesty", () => {
  it("keeps boxscore and outbound news and never copies odds, pickcenter, winprob, or ATS", () => {
    const depth = parseGamecastDepth({
      boxscore: {
        teams: [
          {
            homeAway: "home",
            team: { id: "30", abbreviation: "TB", displayName: "Rays" },
            statistics: [
              {
                name: "batting",
                displayName: "Batting",
                stats: [{ name: "hits", abbreviation: "H", displayValue: "6" }],
              },
            ],
          },
        ],
        players: [
          {
            team: { id: "30", abbreviation: "TB", displayName: "Rays" },
            statistics: [
              {
                type: "batting",
                labels: ["H"],
                names: ["H"],
                athletes: [{ athlete: { displayName: "Junior Caminero" }, stats: ["2"] }],
              },
            ],
          },
        ],
      },
      article: {
        type: "Recap",
        headline: "Caminero walk-off lifts Rays",
        story: "<p>Invented HTML recap that must never ship first-party.</p>",
        links: { web: { href: "http://www.espn.com/mlb/recap?gameId=401816943" } },
      },
      news: {
        articles: [
          {
            headline: "Clip from the booth",
            links: { web: { href: "https://www.espn.com/video/clip/_/id/49953320/clip" } },
          },
          {
            headline: "Off-network gossip",
            links: { web: { href: "https://example.com/not-espn" } },
          },
        ],
      },
      odds: { details: "TB -145" },
      pickcenter: [{ spread: -1.5 }],
      winprobability: [{ homeWinPercentage: 0.61 }],
      againstTheSpread: [{ records: [] }],
    });
    assert.equal(depth.teamStats[0]?.statistics[0]?.displayValue, "6");
    assert.equal(depth.playerBox.available, true);
    assert.equal(depth.news.article?.headline, "Caminero walk-off lifts Rays");
    assert.equal(depth.news.article?.href, "http://www.espn.com/mlb/recap?gameId=401816943");
    assert.equal(depth.news.articles.length, 1);
    assert.equal(JSON.stringify(depth).includes("Invented HTML recap"), false);
    assert.equal(
      JSON.stringify(depth).includes("homeWinPercentage") ||
        JSON.stringify(depth).includes("TB -145") ||
        JSON.stringify(depth).includes("-1.5"),
      false
    );
  });
});
