import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { sportResearchHref } from "./board-url";
import {
  defaultResearchDirs,
  getResearchBrief,
  loadResearchFeed,
  type ResearchBrief,
} from "./research";

const FORBIDDEN = /pnl|polymarket|monte.?carlo|winprob|pickcenter|\bats\b|paid.?odds|\bwpa\b/i;
const scratch: string[] = [];

after(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

async function writeJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function briefShape(brief: ResearchBrief) {
  return {
    id: brief.id,
    kind: brief.kind,
    title: brief.title,
    sample: brief.sample,
    simulation: brief.simulation,
    evidence: brief.evidence,
    inference: brief.inference,
    narrative: brief.narrative,
  };
}

describe("defaultResearchDirs", () => {
  it("defaults to repo research/ then public/research, and RESEARCH_DIR replaces the repo folder", () => {
    const cwd = "/workspace";
    assert.deepEqual(defaultResearchDirs({ cwd, env: {} }), [
      "/workspace/research",
      "/workspace/public/research",
    ]);
    assert.deepEqual(
      defaultResearchDirs({ cwd, env: { RESEARCH_DIR: "/lab/harmon-line-lab" } }),
      ["/lab/harmon-line-lab", "/workspace/public/research"]
    );
  });
});

describe("loadResearchFeed empty honesty", () => {
  it("returns demo:false and NO BRIEF ON THIS FEED YET when directories are empty", async () => {
    const empty = await tempDir("harmon-research-empty-");
    const feed = await loadResearchFeed({
      dirs: [empty],
      now: new Date("2026-09-16T16:00:00Z"),
    });
    assert.equal(feed.source, "disk");
    assert.equal(feed.demo, false);
    assert.equal(feed.generatedAt, "2026-09-16T16:00:00.000Z");
    assert.equal(feed.latestDeepLore, null);
    assert.deepEqual(feed.xrays, []);
    assert.deepEqual(feed.briefs, []);
    assert.equal(feed.honesty.headline, "NO BRIEF ON THIS FEED YET");
    assert.match(feed.honesty.detail, /never invent/i);
    assert.doesNotMatch(JSON.stringify(feed.briefs), FORBIDDEN);
  });

  it("treats missing directories as empty, not as an error", async () => {
    const missing = join(tmpdir(), "harmon-research-missing-does-not-exist");
    const feed = await loadResearchFeed({ dirs: [missing] });
    assert.equal(feed.demo, false);
    assert.equal(feed.honesty.headline, "NO BRIEF ON THIS FEED YET");
    assert.equal(feed.briefs.length, 0);
  });
});

describe("loadResearchFeed json", () => {
  it("lists the latest Deep Lore brief and recent X-Rays from staged JSON", async () => {
    const dir = await tempDir("harmon-research-json-");
    await writeJson(dir, "deep-lore-old.json", {
      kind: "deep-lore",
      title: "Week 2 pace anomaly",
      publishedAt: "2026-09-08T12:00:00Z",
      evidence: ["ESPN published Alabama 31, Vanderbilt 14 on 2026-09-07."],
      inference: ["That score is a restatement of the published cell, not a projection."],
    });
    await writeJson(dir, "deep-lore-new.json", {
      kind: "deep-lore",
      title: "SEC red-zone cluster",
      publishedAt: "2026-09-15T18:00:00Z",
      league: "cfb",
      evidence: ["Georgia scored on 4 of 4 ESPN-published red-zone trips vs Auburn."],
      inference: ["Cluster is a count of published scoring drives, not an invented WPA."],
    });
    await writeJson(dir, "postgame-xray-late.json", {
      kind: "postgame-xray",
      title: "Ohio State at Texas — tactical X-Ray",
      publishedAt: "2026-09-13T04:00:00Z",
      gameId: "401856682",
      evidence: ["Final: Ohio State 14, Texas 7 as published by ESPN."],
      inference: ["Explosive-play gap is inferred from the published play list."],
      narrative: "Model writeup of the published drive chart.",
      simulation: true,
    });
    await writeJson(dir, "postgame-xray-early.json", {
      kind: "postgame-xray",
      title: "Earlier slate X-Ray",
      publishedAt: "2026-09-07T04:00:00Z",
      evidence: ["Final published as 17-10."],
      inference: [],
      narrative: "Shorter model note.",
    });

    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(feed.demo, false);
    assert.equal(feed.honesty.headline, "RESEARCH FEED");
    assert.equal(feed.latestDeepLore?.title, "SEC red-zone cluster");
    assert.equal(feed.latestDeepLore?.kind, "deep-lore");
    assert.equal(feed.latestDeepLore?.league, "cfb");
    assert.deepEqual(
      feed.xrays.map((brief) => brief.title),
      ["Ohio State at Texas — tactical X-Ray", "Earlier slate X-Ray"]
    );
    assert.equal(feed.xrays[0]?.simulation, true);
    assert.equal(feed.xrays[0]?.narrative, "Model writeup of the published drive chart.");
    assert.equal(feed.briefs.length, 4);
    assert.equal(feed.briefs[0]?.title, "SEC red-zone cluster");
  });

  it("labels SAMPLE fixtures and keeps demo false", async () => {
    const dir = await tempDir("harmon-research-sample-");
    await writeJson(dir, "deep-lore.sample.json", {
      kind: "deep-lore",
      title: "Sample anomaly shape",
      publishedAt: "2026-09-01T00:00:00Z",
      sample: true,
      evidence: ["This row is a labeled SAMPLE fixture, not a live cron brief."],
      inference: ["Do not treat SAMPLE copy as an on-feed anomaly."],
    });
    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(feed.demo, false);
    assert.equal(feed.latestDeepLore?.sample, true);
    assert.equal(feed.latestDeepLore?.id, "deep-lore.sample");
    assert.match(feed.honesty.detail, /SAMPLE/);
  });

  it("skips invalid JSON, unknown kinds, and betting-only payloads", async () => {
    const dir = await tempDir("harmon-research-skip-");
    await writeFile(join(dir, "broken.json"), "{not json", "utf8");
    await writeJson(dir, "notes.json", { title: "hello" });
    await writeJson(dir, "odds.json", {
      kind: "deep-lore",
      title: "Secret line",
      winprob: 0.61,
      polymarket: "yes",
      pnl: 12,
    });
    await writeFile(join(dir, "readme.txt"), "ignore me", "utf8");
    await writeFile(
      join(dir, "README.md"),
      `---
kind: deep-lore
title: Documentation is not a brief
---

## Narrative
This README should never appear on the research feed.
`,
      "utf8"
    );
    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(feed.briefs.length, 0);
    assert.equal(feed.honesty.headline, "NO BRIEF ON THIS FEED YET");
    assert.doesNotMatch(JSON.stringify(feed.briefs), FORBIDDEN);
  });

  it("prefers the first directory when ids collide and merges public drop files", async () => {
    const primary = await tempDir("harmon-research-primary-");
    const drop = await tempDir("harmon-research-drop-");
    await writeJson(primary, "deep-lore-shared.json", {
      kind: "deep-lore",
      title: "Primary brief",
      publishedAt: "2026-09-10T00:00:00Z",
      evidence: ["Primary evidence cell."],
      inference: [],
    });
    await writeJson(drop, "deep-lore-shared.json", {
      kind: "deep-lore",
      title: "Drop brief should not win",
      publishedAt: "2026-09-12T00:00:00Z",
      evidence: ["Should be ignored because id already loaded."],
      inference: [],
    });
    await writeJson(drop, "postgame-xray-drop.json", {
      kind: "postgame-xray",
      title: "Drop X-Ray",
      publishedAt: "2026-09-11T00:00:00Z",
      evidence: ["Copied onto the DELL drop folder."],
      inference: [],
      narrative: "Model note from the drop folder.",
    });
    const feed = await loadResearchFeed({ dirs: [primary, drop] });
    assert.equal(feed.latestDeepLore?.title, "Primary brief");
    assert.equal(feed.xrays[0]?.title, "Drop X-Ray");
    assert.equal(feed.briefs.length, 2);
  });

  it("looks up a brief by id and returns null for unknown or traversal ids", async () => {
    const dir = await tempDir("harmon-research-get-");
    await writeJson(dir, "deep-lore-alpha.json", {
      kind: "deep-lore",
      title: "Alpha",
      publishedAt: "2026-09-16T00:00:00Z",
      evidence: ["Published cell A."],
      inference: [],
    });
    await writeJson(dir, "deep-lore-evil.json", {
      id: "../secrets",
      kind: "deep-lore",
      title: "Traversal id is rewritten",
      publishedAt: "2026-09-15T00:00:00Z",
      evidence: ["Published cell B."],
      inference: [],
    });
    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(getResearchBrief(feed, "deep-lore-alpha")?.title, "Alpha");
    assert.equal(getResearchBrief(feed, "nope"), null);
    assert.equal(getResearchBrief(feed, "../secrets"), null);
    assert.equal(feed.briefs.find((brief) => brief.title === "Traversal id is rewritten")?.id, "deep-lore-evil");
  });
});

describe("loadResearchFeed markdown", () => {
  it("parses lab-style deep-lore and postgame-xray markdown with Evidence vs Inference", async () => {
    const dir = await tempDir("harmon-research-md-");
    await writeFile(
      join(dir, "deep-lore-2026-09-16.md"),
      `# Pace cluster on the published slate

## Evidence
- ESPN published Ohio State 14, Texas 7.
- Four published scoring plays, all in the second half.

## Inference
- That is a restatement of the ESPN summary, not an invented anomaly score.

## Narrative
Model paragraph describing the published pace cluster.
`,
      "utf8"
    );
    await writeFile(
      join(dir, "postgame-xray-401856682.md"),
      `---
title: Ohio State at Texas X-Ray
publishedAt: 2026-09-13T05:00:00Z
league: cfb
gameId: "401856682"
---

## Evidence
- Final score 14-7 as published.

## Inference
- Explosive gap inferred from the published play list.

## Narrative
Simulation writeup of the published drives.
`,
      "utf8"
    );

    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(feed.demo, false);
    assert.equal(feed.latestDeepLore?.kind, "deep-lore");
    assert.equal(feed.latestDeepLore?.title, "Pace cluster on the published slate");
    assert.deepEqual(feed.latestDeepLore?.evidence, [
      "ESPN published Ohio State 14, Texas 7.",
      "Four published scoring plays, all in the second half.",
    ]);
    assert.equal(feed.latestDeepLore?.simulation, true);
    assert.match(feed.latestDeepLore?.narrative ?? "", /pace cluster/);
    assert.equal(feed.xrays[0]?.kind, "postgame-xray");
    assert.equal(feed.xrays[0]?.title, "Ohio State at Texas X-Ray");
    assert.equal(feed.xrays[0]?.gameId, "401856682");
    assert.equal(feed.xrays[0]?.league, "cfb");
    assert.equal(feed.xrays[0]?.simulation, true);
    assert.equal(feed.xrays[0]?.publishedAt, "2026-09-13T05:00:00.000Z");
  });

  it("does not invent evidence when a markdown file has no Evidence section", async () => {
    const dir = await tempDir("harmon-research-md-empty-");
    await writeFile(
      join(dir, "deep-lore-empty.md"),
      `# Untitled thought

## Narrative
Model chatter with no published cells.
`,
      "utf8"
    );
    const feed = await loadResearchFeed({ dirs: [dir] });
    assert.equal(feed.latestDeepLore?.evidence.length, 0);
    assert.equal(feed.latestDeepLore?.inference.length, 0);
    assert.equal(feed.latestDeepLore?.title, "Untitled thought");
    assert.doesNotMatch(JSON.stringify(feed.latestDeepLore), FORBIDDEN);
  });
});

describe("sportResearchHref", () => {
  it("keeps CFB research at /research and preserves sibling league plus brief id", () => {
    assert.equal(sportResearchHref("cfb"), "/research");
    assert.equal(sportResearchHref("mbb"), "/research?league=mbb");
    assert.equal(sportResearchHref("nfl", "deep-lore-alpha"), "/research?league=nfl&id=deep-lore-alpha");
    assert.equal(sportResearchHref("cfb", "postgame-xray-1"), "/research?id=postgame-xray-1");
  });
});

describe("repo drop folders stay empty by default", () => {
  it("does not auto-load research/examples SAMPLE fixtures from the checkout", async () => {
    const feed = await loadResearchFeed({ cwd: process.cwd() });
    assert.equal(feed.demo, false);
    assert.equal(feed.latestDeepLore, null);
    assert.deepEqual(feed.xrays, []);
    assert.deepEqual(feed.briefs, []);
    assert.equal(feed.honesty.headline, "NO BRIEF ON THIS FEED YET");
  });
});

describe("briefShape helper stays honest", () => {
  it("does not add odds fields onto a loaded brief", async () => {
    const dir = await tempDir("harmon-research-shape-");
    await mkdir(join(dir, "nested"), { recursive: true });
    await writeJson(dir, "deep-lore-ok.json", {
      kind: "deep-lore",
      title: "Ok",
      publishedAt: "2026-09-16T00:00:00Z",
      evidence: ["A published cell."],
      inference: ["A labeled restatement."],
      odds: { spread: -7.5 },
      winProb: 0.72,
    });
    await writeJson(join(dir, "nested"), "deep-lore-nested.json", {
      kind: "deep-lore",
      title: "Nested should not load",
      publishedAt: "2026-09-16T00:00:00Z",
      evidence: ["Should stay off the feed."],
      inference: [],
    });
    const feed = await loadResearchFeed({ dirs: [dir] });
    const brief = feed.latestDeepLore;
    assert.ok(brief);
    const shape = briefShape(brief);
    assert.equal(shape.kind, "deep-lore");
    assert.doesNotMatch(JSON.stringify(brief), FORBIDDEN);
    assert.equal("odds" in brief, false);
    assert.equal("winProb" in brief, false);
    assert.equal(feed.briefs.length, 1);
    assert.equal(
      feed.briefs.some((entry) => entry.title === "Nested should not load"),
      false
    );
  });
});
