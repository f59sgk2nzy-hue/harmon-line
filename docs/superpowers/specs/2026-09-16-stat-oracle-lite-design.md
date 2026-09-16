# Stat Oracle lite v0

Natural-language situational Q&A over **public ESPN JSON already used by The Harmon Line**. Not StatMuse SQL. Not a live agent-feed upgrade.

## Goal

A dogfoodable `/oracle` surface plus `GET|POST /api/oracle` that answers a named game/team/league question from one fetched ESPN **scoreboard or summary** slice (rankings/team when the named entity is on those feeds). Evidence and inference stay labeled. Scores, sample sizes, percentiles, and video are never invented.

## Out of scope

Scrub-to-Film, Coach Cam, GM Sandbox, Momentum Wave, Debate Arena, live agent-status feed, paid odds, pickcenter/winprob/ATS/Polymarket answers.

## Architecture

1. **Parse** the question for league + entity (team names, `vs`/`at`/`@`, ESPN event id) and intent (score, record, rank, leaders, situation, schedule, betting, video).
2. **Fetch** existing helpers only: `getScoreboard`, optional `getGameDetail` for a matched event, optional `getRankings` / `getTeamPage` when the named school/club is on those feeds. Optional CFBD season-stat fill **only** when `CFBD_API_KEY` is set — never invent CFBD cells.
3. **Assemble** `{ demo: false, evidence[], inference[], answerMarkdown, sources[] }` from published cells. Missing modules → honest empty / "not on this feed".
4. **Refuse** betting advice (ATS, spread, moneyline, over/under, parlays, Polymarket, pickcenter, winprob). RG disclaimer when the question is betting-adjacent.

## Honesty

| Bucket | Meaning |
| --- | --- |
| Evidence | Copied from ESPN (or CFBD fill of a blank ESPN cell). |
| Inference | Restatement / labeled narrative. No invented numbers. Predictions and Deep Dive sims are **not** Oracle v0 — say so. |
| Empty | Named entity not on this scoreboard/summary/rankings slice. |

## UI

`/oracle` with ESPN-nostalgia chrome (existing `BoardHeader` red bar + gold rule). Header **ORACLE** chip. Sport switcher stays on `/oracle?league=`. Link from Deep Dive / game detail. 44px targets, PWA-safe. OPS graph roster unchanged.

## Tests

Lib unit tests with injected ESPN fixtures (no network). Forbidden: invented scores, percentiles, video ids, odds chrome. Existing OPS / multi-sport tests stay green. `npm test` and `npm run build`.
