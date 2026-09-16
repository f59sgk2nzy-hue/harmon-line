import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LEAGUE,
  LEAGUE_IDS,
  LeagueNotShippedError,
  SPORT_LEAGUES,
  assertLeagueShipped,
  getLeague,
  parseLeagueParam,
  shippedLeagues,
} from "./leagues";

describe("SportLeague registry", () => {
  it("registers cfb plus shipped mbb and nba/nfl/mlb stubs", () => {
    assert.deepEqual([...LEAGUE_IDS], ["cfb", "mbb", "nba", "nfl", "mlb"]);
    assert.equal(DEFAULT_LEAGUE, "cfb");
    assert.equal(SPORT_LEAGUES.cfb.shipped, true);
    assert.equal(SPORT_LEAGUES.mbb.shipped, true);
    assert.equal(SPORT_LEAGUES.nba.shipped, false);
    assert.equal(SPORT_LEAGUES.nfl.shipped, false);
    assert.equal(SPORT_LEAGUES.mlb.shipped, false);
    assert.deepEqual(
      shippedLeagues().map((league) => league.id),
      ["cfb", "mbb"]
    );
  });

  it("wires CFB to ESPN football/college-football with week nav, NCAA logos, drives, and rankings", () => {
    const cfb = getLeague("cfb");
    assert.equal(cfb.id, "cfb");
    assert.equal(cfb.sport, "football");
    assert.equal(cfb.league, "college-football");
    assert.equal(cfb.navMode, "week");
    assert.equal(cfb.logoNamespace, "ncaa");
    assert.equal(cfb.detailModules.primary, "drives");
    assert.equal(cfb.detailModules.footballSituation, true);
    assert.equal(cfb.rankings, true);
    assert.equal(cfb.shortLabel, "CFB");
    assert.match(cfb.coverage.detail, /never invent/i);
  });

  it("ships MBB with ESPN basketball slugs, date nav, NCAA logos, plays, and rankings", () => {
    const mbb = getLeague("mbb");
    assert.equal(mbb.sport, "basketball");
    assert.equal(mbb.league, "mens-college-basketball");
    assert.equal(mbb.navMode, "date");
    assert.equal(mbb.logoNamespace, "ncaa");
    assert.equal(mbb.detailModules.primary, "plays");
    assert.equal(mbb.detailModules.footballSituation, false);
    assert.equal(mbb.rankings, true);
    assert.equal(mbb.shipped, true);
    assert.equal(mbb.shortLabel, "MBB");
    assert.match(mbb.coverage.headline, /college basketball/i);
    assert.match(mbb.coverage.detail, /group 50/i);
    assert.match(mbb.coverage.detail, /never invent/i);
    assert.doesNotMatch(mbb.coverage.headline, /not shipped/i);
  });

  it("stubs other leagues with ESPN slugs, logo namespaces, and detail modules", () => {

    const nba = getLeague("nba");
    assert.equal(nba.sport, "basketball");
    assert.equal(nba.league, "nba");
    assert.equal(nba.navMode, "date");
    assert.equal(nba.logoNamespace, "nba");
    assert.equal(nba.detailModules.primary, "plays");
    assert.equal(nba.detailModules.footballSituation, false);
    assert.equal(nba.rankings, false);

    const nfl = getLeague("nfl");
    assert.equal(nfl.sport, "football");
    assert.equal(nfl.league, "nfl");
    assert.equal(nfl.navMode, "week");
    assert.equal(nfl.logoNamespace, "nfl");
    assert.equal(nfl.detailModules.primary, "drives");
    assert.equal(nfl.detailModules.footballSituation, true);
    assert.equal(nfl.rankings, false);

    const mlb = getLeague("mlb");
    assert.equal(mlb.sport, "baseball");
    assert.equal(mlb.league, "mlb");
    assert.equal(mlb.navMode, "date");
    assert.equal(mlb.logoNamespace, "mlb");
    assert.equal(mlb.detailModules.primary, "atBats");
    assert.equal(mlb.detailModules.footballSituation, false);
    assert.equal(mlb.rankings, false);
  });

  it("keeps unshipped stub coverage honest — no invented scores, not shipped yet", () => {
    for (const id of ["nba", "nfl", "mlb"] as const) {
      const league = getLeague(id);
      assert.match(league.coverage.headline, /not shipped/i);
      assert.match(league.coverage.detail, /never invent/i);
      assert.match(league.coverage.detail, /no scoreboard/i);
    }
  });
});

describe("parseLeagueParam", () => {
  it("defaults missing, blank, and unknown values to cfb so existing clients keep working", () => {
    assert.equal(parseLeagueParam(null), "cfb");
    assert.equal(parseLeagueParam(undefined), "cfb");
    assert.equal(parseLeagueParam(""), "cfb");
    assert.equal(parseLeagueParam("nope"), "cfb");
    assert.equal(parseLeagueParam("college-football"), "cfb");
  });

  it("reads known league slugs case-insensitively", () => {
    assert.equal(parseLeagueParam("cfb"), "cfb");
    assert.equal(parseLeagueParam("MBB"), "mbb");
    assert.equal(parseLeagueParam("Nba"), "nba");
    assert.equal(parseLeagueParam("nfl"), "nfl");
    assert.equal(parseLeagueParam("mlb"), "mlb");
  });
});

describe("assertLeagueShipped", () => {
  it("allows CFB and MBB and rejects remaining stubs without fabricating a board", () => {
    assert.equal(assertLeagueShipped("cfb").id, "cfb");
    assert.equal(assertLeagueShipped("mbb").id, "mbb");
    assert.throws(() => assertLeagueShipped("nfl"), LeagueNotShippedError);
    try {
      assertLeagueShipped("nba");
      assert.fail("expected stub league to throw");
    } catch (error) {
      assert.equal(error instanceof LeagueNotShippedError, true);
      const shipped = error as LeagueNotShippedError;
      assert.equal(shipped.league.id, "nba");
      assert.equal(shipped.status, 501);
      assert.equal(shipped.payload.demo, false);
      assert.equal(shipped.payload.source, "espn");
      assert.equal(shipped.payload.league, "nba");
    }
  });
});
