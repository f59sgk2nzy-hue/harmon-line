# The Harmon Line

Nostalgic ESPN-style live college football scoreboard for **Christian Harmon**. It covers NCAA Division I (FBS + FCS), NCAA Division II, and NAIA using public ESPN scoreboard/summary feeds — no API key.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43173](http://localhost:43173). The home board defaults to **today’s games in US/Eastern**. Click any game for a detail page with scoring, leaders, and play-by-play when ESPN publishes it.

Production-style start:

```bash
npm run build
npm start
```

## Environment variables

None required. Copy `.env.example` only if you want to point at a different ESPN host.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ESPN_WEB_BASE` | no | Primary public host (defaults to `site.web.api.espn.com` … `/college-football`) |
| `ESPN_SITE_BASE` | no | Fallback host (`site.api.espn.com` — some networks block it) |

## Data sources and coverage

**Source:** ESPN’s unofficial public site API (same JSON the espn.com scoreboard uses).

| Division | ESPN group | Scores | Play-by-play |
| --- | --- | --- | --- |
| NCAA D1 FBS | `80` | Yes, near-live | Usually yes on nationally covered games |
| NCAA D1 FCS | `81` | Yes | Mixed — many games are scores-only |
| NCAA D2 | `57` | Yes | Minority of games |
| NAIA | `186` | Partial | Almost never |

**NAIA gap:** ESPN’s NAIA group is real, but it mostly carries crossover games (NAIA vs NCAA) and a thin Saturday slate. Many NAIA-vs-NAIA contests never appear. [NAIA Stats / PrestoSports](https://naiastats.prestosports.com/sports/fball/scoreboard) has a fuller board but sits behind Cloudflare; this app does not scrape it.

**Honesty rule:** The app never invents live scores. If ESPN is unreachable you get an error state, not a silent demo. There is no sample-score mode.

Polling: the board refreshes about every 12s while any game is live (40s otherwise). Game pages poll every 8s when in progress.

## What you can do

- Filter D1 / D2 / NAIA, plus FBS vs FCS on Division I
- Filter by conference, live/upcoming/final, team search, and date
- Open a game for the scorebug, quarter lines, scoring plays, and a drive-by-drive feed (or a clear “no PBP” state)
- Watch the bottom-line ticker for the full slate

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Server routes proxy ESPN so the browser stays same-origin.
