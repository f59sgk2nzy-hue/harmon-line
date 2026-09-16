# Harmon Line research ingest

Read-only Deep Lore + Post-Game Tactical X-Ray briefs for `/research` and `GET /api/research`.

## Where files are read

| Path | Role |
| --- | --- |
| `RESEARCH_DIR` | Optional override (lab box: `/workspace/harmon-line-lab`) |
| `research/` (this folder, top-level `*.json` / `*.md` only) | Repo-local staging |
| `public/research/` | DELL drop folder — copy files here so the Next app can see them without the lab filesystem |

Subfolders such as `research/examples/` are **not** scanned. Live empty is honest: **NO BRIEF ON THIS FEED YET**.

## JSON schema

```json
{
  "kind": "deep-lore",
  "title": "Published red-zone cluster",
  "publishedAt": "2026-09-16T18:00:00Z",
  "league": "cfb",
  "gameId": null,
  "sample": false,
  "evidence": ["Copied from a published ESPN cell or Board note."],
  "inference": ["Labeled restatement. No invented WPA."],
  "narrative": "Optional model writeup. The UI stamps SIMULATION on this block.",
  "simulation": true,
  "sources": [{ "label": "ESPN summary" }]
}
```

`kind` is `deep-lore` or `postgame-xray`. Markdown from Board routines is also accepted when the filename starts with `deep-lore-` or `postgame-xray-` and uses `## Evidence`, `## Inference`, and `## Narrative` headings.

Odds, pickcenter, betting `winprob`, Polymarket, PnL, and WPA fields **on the brief file** are ignored. Post-Game X-Ray detail (and the featured list strip) may attach `xrayGraph` / `featuredXrayGraph` from ESPN summary `winprobability` for a digit `gameId` + league. If ESPN omitted that series the graph is **WIN PROBABILITY NOT ON THIS FEED** — never invented. Chrome: Evidence (ESPN WP series), not odds/ATS/pickcenter. `demo` on the API is always `false`.

## SAMPLE fixtures

Copy from `research/examples/` into `public/research/` only when you want a labeled SAMPLE card. They are not live cron output.
