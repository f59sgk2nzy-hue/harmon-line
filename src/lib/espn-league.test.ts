import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGameDetail, getScoreboard } from "./espn";
import { LeagueNotShippedError } from "./leagues";

describe("unshipped league fetch gate", () => {
  it("rejects scoreboard and game detail for stubs before talking to ESPN", async () => {
    await assert.rejects(
      () => getScoreboard({ division: "d1", date: "20260915", league: "mbb" }),
      (error: unknown) =>
        error instanceof LeagueNotShippedError &&
        error.status === 501 &&
        error.payload.demo === false &&
        error.payload.league === "mbb"
    );
    await assert.rejects(
      () => getGameDetail("401858213", "nba"),
      (error: unknown) =>
        error instanceof LeagueNotShippedError && error.payload.league === "nba"
    );
  });
});
