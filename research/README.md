# Harmon Line research ingest

Read-only Deep Lore + Post-Game Tactical X-Ray briefs for `/research` and `GET /api/research`.

Google-grounded ask lives on the same page (`?q=`) and on `GET|POST /api/research/ask`. It does not read these files. Set `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` (or `GOOGLE_SEARCH_ENGINE_ID`) for real Custom Search snippets; missing keys return **GOOGLE SEARCH NOT CONFIGURED**.

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

Odds, pickcenter, winprob, Polymarket, PnL, and WPA fields are ignored. `demo` on the API is always `false`.

## SAMPLE fixtures

Copy from `research/examples/` into `public/research/` only when you want a labeled SAMPLE card. They are not live cron output.
