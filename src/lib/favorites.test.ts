import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sportFavoritesHref } from "./board-url";
import { favoriteKey } from "./leagues";
import {
  FAVORITES_STORAGE_KEY,
  emptyFavorites,
  favoriteKeySet,
  gameHasFavorite,
  groupFavoritePins,
  loadFavorites,
  memoryFavoritesStore,
  parseFavoriteKey,
  parseFavoritesPayload,
  pinFromTeam,
  prioritizeFavoriteGames,
  saveFavorites,
  toggleFavoritePin,
} from "./favorites";
import type { GameSummary, TeamSide } from "./types";

function side(
  partial: Partial<TeamSide> & Pick<TeamSide, "id" | "shortName" | "abbreviation" | "homeAway">
): TeamSide {
  return {
    name: partial.name ?? partial.shortName,
    score: null,
    record: "2-0",
    rank: null,
    color: null,
    altColor: null,
    logo: "",
    conferenceId: "8",
    conferenceName: "SEC",
    winner: false,
    linescores: [],
    ...partial,
  };
}

function game(partial: Partial<GameSummary> & Pick<GameSummary, "id" | "home" | "away">): GameSummary {
  return {
    name: `${partial.away.shortName} at ${partial.home.shortName}`,
    shortName: `${partial.away.abbreviation} @ ${partial.home.abbreviation}`,
    date: "2026-09-12T23:30Z",
    week: 3,
    status: {
      state: "pre",
      detail: "Scheduled",
      shortDetail: "Sat 7:30 PM ET",
      period: null,
      clock: null,
      completed: false,
    },
    venue: "DKR",
    venueCity: "Austin, TX",
    broadcast: "ABC",
    situation: null,
    playByPlayAvailable: false,
    subdivision: "FBS",
    conferenceIds: ["8"],
    ...partial,
  };
}

const BILLS = pinFromTeam("nfl", {
  id: "2",
  name: "Buffalo Bills",
  shortName: "Bills",
  abbreviation: "BUF",
  logo: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
});

const CFB_TWO = pinFromTeam("cfb", {
  id: "2",
  name: "Auburn Tigers",
  shortName: "Auburn",
  abbreviation: "AUB",
  logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2.png",
});

const YANKEES = pinFromTeam("mlb", {
  id: "15",
  name: "New York Yankees",
  shortName: "Yankees",
  abbreviation: "NYY",
  logo: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png",
});

describe("parseFavoriteKey", () => {
  it("keeps CFB/NFL/MLB ids in separate namespaces", () => {
    assert.deepEqual(parseFavoriteKey("nfl:2"), { league: "nfl", teamId: "2" });
    assert.deepEqual(parseFavoriteKey("cfb:2"), { league: "cfb", teamId: "2" });
    assert.deepEqual(parseFavoriteKey("mlb:15"), { league: "mlb", teamId: "15" });
    assert.notEqual(favoriteKey("nfl", "2"), favoriteKey("cfb", "2"));
    assert.notEqual(favoriteKey("mlb", "15"), favoriteKey("cfb", "15"));
  });

  it("rejects unscoped ids and unknown leagues instead of collapsing them to CFB", () => {
    assert.equal(parseFavoriteKey("2"), null);
    assert.equal(parseFavoriteKey("nope:2"), null);
    assert.equal(parseFavoriteKey("college-football:333"), null);
    assert.equal(parseFavoriteKey("nfl:"), null);
    assert.equal(parseFavoriteKey(""), null);
  });
});

describe("favorites payload honesty", () => {
  it("starts empty with demo:false and no invented pins", () => {
    const empty = emptyFavorites();
    assert.equal(empty.demo, false);
    assert.deepEqual(empty.pins, []);
    assert.deepEqual(parseFavoritesPayload(null), empty);
    assert.deepEqual(parseFavoritesPayload(""), empty);
    assert.deepEqual(parseFavoritesPayload("{not json"), empty);
    assert.deepEqual(parseFavoritesPayload("[]"), empty);
  });

  it("drops demo:true sample payloads instead of showing fake followed teams", () => {
    const raw = JSON.stringify({
      demo: true,
      pins: [{ league: "cfb", teamId: "333", name: "Sample Tide", shortName: "Bama", abbreviation: "ALA", logo: "" }],
    });
    const parsed = parseFavoritesPayload(raw);
    assert.equal(parsed.demo, false);
    assert.deepEqual(parsed.pins, []);
  });

  it("keeps real pins and forces demo:false even if the demo flag was omitted", () => {
    const raw = JSON.stringify({ pins: [BILLS, CFB_TWO, YANKEES] });
    const parsed = parseFavoritesPayload(raw);
    assert.equal(parsed.demo, false);
    assert.equal(parsed.pins.length, 3);
    assert.equal(favoriteKey(parsed.pins[0]!.league, parsed.pins[0]!.teamId), "nfl:2");
    assert.equal(favoriteKey(parsed.pins[1]!.league, parsed.pins[1]!.teamId), "cfb:2");
    assert.equal(favoriteKey(parsed.pins[2]!.league, parsed.pins[2]!.teamId), "mlb:15");
  });
});

describe("favorites store toggle", () => {
  it("pins, persists, and unpins through the storage key without mixing leagues", () => {
    const store = memoryFavoritesStore();
    assert.deepEqual(loadFavorites(store).pins, []);

    let next = toggleFavoritePin(loadFavorites(store), BILLS);
    saveFavorites(store, next);
    next = toggleFavoritePin(loadFavorites(store), CFB_TWO);
    saveFavorites(store, next);

    const loaded = loadFavorites(store);
    assert.equal(loaded.demo, false);
    assert.equal(loaded.pins.length, 2);
    assert.equal(loaded.pins.some((pin) => favoriteKey(pin.league, pin.teamId) === "nfl:2"), true);
    assert.equal(loaded.pins.some((pin) => favoriteKey(pin.league, pin.teamId) === "cfb:2"), true);
    assert.equal(loaded.pins.some((pin) => pin.teamId === "2" && pin.league === "nfl"), true);

    saveFavorites(store, toggleFavoritePin(loaded, BILLS));
    const after = loadFavorites(store);
    assert.equal(after.pins.some((pin) => favoriteKey(pin.league, pin.teamId) === "nfl:2"), false);
    assert.equal(after.pins.some((pin) => favoriteKey(pin.league, pin.teamId) === "cfb:2"), true);
  });
});

describe("prioritizeFavoriteGames", () => {
  it("floats games that involve a pinned team and leaves the rest in original order", () => {
    const auburn = game({
      id: "cfb-aub",
      away: side({ id: "99", shortName: "Other", abbreviation: "OTR", homeAway: "away" }),
      home: side({ id: "2", shortName: "Auburn", abbreviation: "AUB", homeAway: "home" }),
    });
    const first = game({
      id: "a",
      away: side({ id: "194", shortName: "Ohio State", abbreviation: "OSU", homeAway: "away" }),
      home: side({ id: "251", shortName: "Texas", abbreviation: "TEX", homeAway: "home" }),
    });
    const bills = game({
      id: "nfl-buf",
      away: side({ id: "2", shortName: "Bills", abbreviation: "BUF", homeAway: "away" }),
      home: side({ id: "12", shortName: "Chiefs", abbreviation: "KC", homeAway: "home" }),
    });
    const last = game({
      id: "b",
      away: side({ id: "8", shortName: "Arkansas", abbreviation: "ARK", homeAway: "away" }),
      home: side({ id: "333", shortName: "Alabama", abbreviation: "ALA", homeAway: "home" }),
    });

    const keys = favoriteKeySet([CFB_TWO]);
    assert.equal(gameHasFavorite(auburn, "cfb", keys), true);
    assert.equal(gameHasFavorite(bills, "nfl", keys), false);
    assert.equal(gameHasFavorite(first, "cfb", keys), false);

    const ordered = prioritizeFavoriteGames([first, auburn, last], "cfb", keys);
    assert.deepEqual(
      ordered.map((row) => row.id),
      ["cfb-aub", "a", "b"]
    );
  });

  it("does not reorder the slate when there are no pins", () => {
    const games = [
      game({
        id: "a",
        away: side({ id: "1", shortName: "A", abbreviation: "A", homeAway: "away" }),
        home: side({ id: "2", shortName: "B", abbreviation: "B", homeAway: "home" }),
      }),
      game({
        id: "c",
        away: side({ id: "3", shortName: "C", abbreviation: "C", homeAway: "away" }),
        home: side({ id: "4", shortName: "D", abbreviation: "D", homeAway: "home" }),
      }),
    ];
    const ordered = prioritizeFavoriteGames(games, "cfb", favoriteKeySet([]));
    assert.deepEqual(
      ordered.map((row) => row.id),
      ["a", "c"]
    );
  });
});

describe("groupFavoritePins", () => {
  it("lists the active league first without dropping other sports", () => {
    const groups = groupFavoritePins([BILLS, CFB_TWO, YANKEES], "mlb");
    assert.deepEqual(
      groups.map((group) => group.league),
      ["mlb", "nfl", "cfb"]
    );
    assert.equal(groups[0]!.pins[0]!.abbreviation, "NYY");
  });
});

describe("sportFavoritesHref", () => {
  it("scopes the hub the same way as other sport hubs", () => {
    assert.equal(sportFavoritesHref("cfb"), "/favorites");
    assert.equal(sportFavoritesHref("nfl"), "/favorites?league=nfl");
    assert.equal(sportFavoritesHref("mlb"), "/favorites?league=mlb");
  });
});
