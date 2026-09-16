import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEAGUE_IDS, assertLeagueShipped } from "./leagues";

describe("league fetch gate", () => {
  it("ships every registered league so scoreboard and game detail are not 501 stubs", () => {
    assert.deepEqual([...LEAGUE_IDS], ["cfb", "mbb", "nba", "nfl", "mlb"]);
    for (const id of LEAGUE_IDS) {
      const league = assertLeagueShipped(id);
      assert.equal(league.id, id);
      assert.equal(league.shipped, true);
    }
  });
});
