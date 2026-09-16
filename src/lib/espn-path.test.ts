import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { espnScoreboardPath } from "./espn-weeks";
import {
  DEFAULT_ESPN_SITE_ORIGIN,
  DEFAULT_ESPN_WEB_ORIGIN,
  espnRequestUrl,
  espnSportPath,
  originFromEnv,
  teamLogoUrl,
} from "./espn-path";

describe("originFromEnv", () => {
  it("defaults to host-only ESPN public origins", () => {
    assert.equal(originFromEnv(undefined, DEFAULT_ESPN_WEB_ORIGIN), DEFAULT_ESPN_WEB_ORIGIN);
    assert.equal(originFromEnv("  ", DEFAULT_ESPN_SITE_ORIGIN), DEFAULT_ESPN_SITE_ORIGIN);
    assert.equal(DEFAULT_ESPN_WEB_ORIGIN, "https://site.web.api.espn.com");
    assert.equal(DEFAULT_ESPN_SITE_ORIGIN, "https://site.api.espn.com");
  });

  it("keeps a host-only override", () => {
    assert.equal(
      originFromEnv("https://site.web.api.espn.com", DEFAULT_ESPN_WEB_ORIGIN),
      "https://site.web.api.espn.com"
    );
  });

  it("strips a legacy full CFB path so sport/league can be appended from the registry", () => {
    assert.equal(
      originFromEnv(
        "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football",
        DEFAULT_ESPN_WEB_ORIGIN
      ),
      "https://site.web.api.espn.com"
    );
    assert.equal(
      originFromEnv(
        "https://site.api.espn.com/apis/site/v2/sports/football/college-football",
        DEFAULT_ESPN_SITE_ORIGIN
      ),
      "https://site.api.espn.com"
    );
  });
});

describe("espnSportPath / espnRequestUrl", () => {
  it("builds sports/{sport}/{league} under /apis/site/v2", () => {
    assert.equal(espnSportPath("cfb"), "/apis/site/v2/sports/football/college-football");
    assert.equal(espnSportPath("mbb"), "/apis/site/v2/sports/basketball/mens-college-basketball");
    assert.equal(espnSportPath("nba"), "/apis/site/v2/sports/basketball/nba");
    assert.equal(espnSportPath("nfl"), "/apis/site/v2/sports/football/nfl");
    assert.equal(espnSportPath("mlb"), "/apis/site/v2/sports/baseball/mlb");
  });

  it("keeps the historical CFB scoreboard URL when composing host + league path + query", () => {
    const path = espnScoreboardPath({ group: "80", date: "20260915" });
    assert.equal(
      espnRequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "cfb", path),
      "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&dates=20260915&limit=300"
    );
    assert.equal(
      espnRequestUrl(DEFAULT_ESPN_SITE_ORIGIN, "cfb", "/summary?event=401858217"),
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=401858217"
    );
    assert.equal(
      espnRequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "cfb", "/rankings"),
      "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/rankings"
    );
  });

  it("parameterizes other leagues without baking CFB into the host", () => {
    assert.equal(
      espnRequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "mbb", "/scoreboard?dates=20260915&limit=300"),
      "https://site.web.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20260915&limit=300"
    );
    assert.equal(
      espnRequestUrl(DEFAULT_ESPN_WEB_ORIGIN, "nfl", "/scoreboard?week=1&seasontype=2&limit=300"),
      "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=1&seasontype=2&limit=300"
    );
  });
});

describe("teamLogoUrl", () => {
  it("uses NCAA logos for CFB and MBB, and league CDNs for NBA/NFL/MLB", () => {
    assert.equal(
      teamLogoUrl("333"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png"
    );
    assert.equal(
      teamLogoUrl("333", "cfb"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png"
    );
    assert.equal(
      teamLogoUrl("150", "mbb"),
      "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png"
    );
    assert.equal(
      teamLogoUrl("13", "nba"),
      "https://a.espncdn.com/i/teamlogos/nba/500/13.png"
    );
    assert.equal(
      teamLogoUrl("10", "nfl"),
      "https://a.espncdn.com/i/teamlogos/nfl/500/10.png"
    );
    assert.equal(
      teamLogoUrl("15", "mlb"),
      "https://a.espncdn.com/i/teamlogos/mlb/500/15.png"
    );
  });
});
