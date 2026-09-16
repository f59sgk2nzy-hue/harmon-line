import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySubdivision,
  collectClassificationIds,
  parseLinescores,
} from "./espn-parse";
import { formatPollClock } from "./dates";
import { requestOrigin } from "./origin";

describe("parseLinescores", () => {
  it("reads ESPN summary displayValue periods instead of faking zeros", () => {
    const ala = parseLinescores([
      { displayValue: "7" },
      { displayValue: "6" },
      { displayValue: "18" },
      { displayValue: "14" },
    ]);
    assert.deepEqual(ala, [7, 6, 18, 14]);
  });

  it("keeps a published zero and treats a missing value as null", () => {
    const mixed = parseLinescores([
      { value: 0, displayValue: "0" },
      { displayValue: "10" },
      {},
    ]);
    assert.deepEqual(mixed, [0, 10, null]);
  });

  it("returns an empty list when ESPN omitted period scores", () => {
    assert.deepEqual(parseLinescores(undefined), []);
    assert.deepEqual(parseLinescores([]), []);
  });
});

describe("classifySubdivision", () => {
  it("does not treat NCAAF league id 23 as FBS", () => {
    assert.equal(classifySubdivision(["23"]), null);
  });

  it("does not treat NCAAM league id 41 as a subdivision", () => {
    assert.equal(classifySubdivision(["41"]), null);
    assert.equal(classifySubdivision(["50", "41"]), "D1");
  });

  it("classifies Alabama/Kentucky from the SEC group, not league 23", () => {
    const header = {
      league: { id: "23" },
      competitions: [
        {
          groups: { id: "8", name: "Southeastern Conference" },
          competitors: [
            { team: { groups: { id: "8" }, conferenceId: "8" } },
            { team: { groups: { id: "8" }, conferenceId: "8" } },
          ],
        },
      ],
    };
    const ids = collectClassificationIds(header);
    assert.equal(classifySubdivision(ids), "FBS");
  });

  it("classifies Eastern Oregon @ Whitworth as NAIA, not FBS", () => {
    const header = {
      league: { id: "23" },
      competitions: [
        {
          competitors: [
            { homeAway: "home", team: { groups: { id: "58" } } },
            { homeAway: "away", team: { groups: { id: "186" } } },
          ],
        },
      ],
    };
    const ids = [...collectClassificationIds(header), "58"];
    assert.equal(classifySubdivision(ids), "NAIA");
  });

  it("labels a D3-only group as D3", () => {
    assert.equal(classifySubdivision(["58", "23"]), "D3");
  });
});

describe("formatPollClock", () => {
  it("formats in US/Eastern so search remounts cannot skew the clock", () => {
    const stamp = formatPollClock("2026-09-12T22:43:00.000Z");
    assert.match(stamp, /6:43:00 PM/);
    assert.match(stamp, /EDT|EST|ET/);
  });
});

describe("requestOrigin", () => {
  it("preserves the browser Host when the server bound 0.0.0.0", () => {
    const request = new Request("http://0.0.0.0:43173/api/board?q=alabama", {
      headers: { host: "127.0.0.1:43173" },
    });
    assert.equal(requestOrigin(request), "http://127.0.0.1:43173");
  });

  it("never returns a 0.0.0.0 origin", () => {
    const request = new Request("http://0.0.0.0:43173/api/board");
    assert.doesNotMatch(requestOrigin(request), /0\.0\.0\.0/);
  });
});
