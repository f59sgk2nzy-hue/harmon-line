# The Harmon Line

Nostalgic ESPN-style live college football scoreboard for **Christian Harmon**. It covers NCAA Division I (FBS + FCS), NCAA Division II, and NAIA using public ESPN scoreboard/summary feeds — no API key.

## Run locally

```bash
npm install
npm run dev
```

Unit checks for period scores, subdivision labels, poll-clock timezone, and redirect hosts:

```bash
npm test
```

Open [http://localhost:43173](http://localhost:43173). The home board defaults to **today’s games in US/Eastern**. Click any game for a detail page with scoring, leaders, and play-by-play when ESPN publishes it.

Production-style start:

```bash
npm run build
npm start
```

## Environment variables

None required. Copy `.env.example` only if you want to point at a different ESPN host or add optional YouTube search.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ESPN_WEB_BASE` | no | Primary public host (defaults to `site.web.api.espn.com` … `/college-football`) |
| `ESPN_SITE_BASE` | no | Fallback host (`site.api.espn.com` — some networks block it) |
| `YOUTUBE_API_KEY` | no | Optional YouTube Data API v3 key. Highlights work without it via public channel RSS. |

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

## Highlights / Reactions strip

The home board shows a swipeable **HIGHLIGHTS / REACTIONS** row under the ESPN red header and above the game grid. It mixes game highlights / big plays with reaction videos for the current college football season.

**Default source (no API key):** public YouTube channel Atom RSS — `https://www.youtube.com/feeds/videos.xml?channel_id=…` — from ESPN College Football, CFB ON FOX, Big Ten Network (highlights) plus Cover 3, Brandon Walker CFB, and Barstool Bench Mob (reactions). Titles that say “reacting” / “highlights” override the channel bucket. Thumbnails use `i.ytimg.com`. Cards open YouTube.

**Optional source:** if `YOUTUBE_API_KEY` is set, `/api/highlights` also searches the YouTube Data API (`college football highlights {year}`, `big plays`, `reaction`) and interleaves those results with RSS. The key is never required.

**Fallback:** if every live source is empty, the strip shows **SAMPLE**-labeled cards that link to YouTube search — not live scores, and never mixed into the ESPN scoreboard.

**Mobile / PWA:** the strip is built for Add to Home Screen first — native horizontal touch swipe, snap scrolling, a peek of the next card, 44px play control, and no hover-only UI. Chevrons appear only on wider screens. The home viewport uses `viewport-fit=cover` so the red header and bottom line clear the notch / home indicator.

**Performance:** the strip fetches `/api/highlights` on its own (cached ~2 minutes on the server, refreshed every 15 minutes in the browser). It does not run inside the scoreboard poll. Thumbnails are `loading="lazy"`.

**Refresh:** the board and game pages refresh every **10 minutes** (600 seconds) from the public ESPN feed. Use the **REFRESH** control to pull immediately. The “last polled” clock is always **US/Eastern**.

## Add to Home Screen / pin to desktop

The Harmon Line is a small PWA (dark ESPN theme, standalone display). After it is running in a browser:

**iPhone / iPad (Safari)**
1. Open the board URL.
2. Tap the Share button.
3. Tap **Add to Home Screen**, then Add.

**Android (Chrome)**
1. Open the board URL.
2. Tap the menu (⋮) → **Add to Home screen** / **Install app**.

**Windows**
- **Chrome / Edge:** menu → **Cast, save, and share** / **Apps** → **Install The Harmon Line** (or **Install this site as an app**). It then appears in the Start menu.
- **Pin:** right-click the installed app or a shortcut → **Pin to Start** or **Pin to taskbar**.

The web manifest uses theme/background `#0a0a0a` to match the scoreboard.

## What you can do

- Filter D1 / D2 / NAIA, plus FBS vs FCS on Division I
- Filter by conference, live/upcoming/final, team search, and date
- Open a game for the scorebug, quarter lines, scoring plays, and a drive-by-drive feed (or a clear “no PBP” state)
- Swipe the highlights / reactions strip on a phone or installed PWA for current-season YouTube clips
- Watch the bottom-line ticker for the full slate
- Install the board on a phone home screen or pin it as a Windows app

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Server routes proxy ESPN so the browser stays same-origin.
