# Deep Lore + Post-Game X-Ray research panels v0

Read-only Harmon Line UI for Board-routine writeups. Not a live lab filesystem mount. Not Oracle Q&A. Not Scrub-to-Film.

## Goal

Browse Deep Lore anomaly briefs and Post-Game Tactical X-Rays on `/research`, with Evidence vs Inference labeling and a SIMULATION badge on model narrative. Empty disk is honest: **NO BRIEF ON THIS FEED YET**.

## Ingest

1. `RESEARCH_DIR` if set, else repo `research/` (top-level `*.json` / `*.md` only).
2. Always also scan `public/research/` so DELL can drop files without the agent-lab path.
3. `research/examples/` is not scanned. Copy a SAMPLE fixture into a scanned folder only when you want a **SAMPLE** badge.
4. `GET /api/research` returns `{ demo: false, latestDeepLore, xrays, briefs, honesty }`. `?id=` adds `brief`.

Markdown from Board crons (`deep-lore-*.md`, `postgame-xray-*.md`) uses `## Evidence`, `## Inference`, `## Narrative`. JSON schema lives in `research/README.md`.

## Honesty

- Never invent anomalies, WPA, scores, odds, pickcenter, winprob, Polymarket, or PnL.
- Betting-only JSON is skipped. Extra betting keys on an otherwise valid brief are dropped.
- SAMPLE is a file flag / filename, not a live cron.
- Model narrative is always stamped SIMULATION.

## UI

ESPN-nostalgia chrome via existing `BoardHeader`. Nav chip **RESEARCH** does not replace ORACLE / OPS / the sport switcher. Sport switcher stays on `/research?league=`. 44px targets, PWA-safe.

## Out of scope

POST ingest, live agent-status, Scrub-to-Film, Coach Cam, GM Sandbox, betting chrome.
