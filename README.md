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

Open [http://localhost:43173](http://localhost:43173). The home board defaults to **today’s games in US/Eastern**. Click any game for a detail page with scoring, leaders, and play-by-play when ESPN publishes it. **Rankings** (`/rankings`) lists AP, Coaches, FCS, D2, and D3 polls from the same public ESPN JSON.

**DELL / Home Screen / Tailscale:** prefer production (`npm run build && npm start`). `next dev` gates the HMR websocket (`/_next/hmr`) with an Origin check. Opening the board as `http://127.0.0.1:43173` or a LAN/Tailscale IP can fail that check (`Unauthorized`), so React never hydrates. The highlights strip is server-rendered so cards still paint, but production has no HMR and is the reliable way to pin or share the board. `next.config` sets `allowedDevOrigins` for `localhost`, `127.0.0.1`, Tailscale MagicDNS (`**.ts.net`), and this machine’s LAN/Tailscale IPv4 addresses.

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

## Rankings

`/rankings` is a live poll board (AP, AFCA Coaches, FCS Coaches, AFCA D2, AFCA D3). Switch polls with the sticky tabs; each school name opens `/team/{espnId}`.

**Source:** ESPN’s unofficial public rankings JSON — the same hosts as the scoreboard, no API key:

`GET {ESPN_WEB_BASE|ESPN_SITE_BASE}/rankings`

Example: `https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/rankings` (fallback `site.api.espn.com`).

| Tab | ESPN poll | Typical ESPN `id` |
| --- | --- | --- |
| AP | AP Top 25 | `1` (`type: ap`) |
| COACHES | AFCA Coaches Poll | `2` (`type: usa`) |
| FCS | FCS Coaches Poll | `20` (`type: fcs`) |
| D2 | AFCA Division II Coaches Poll | `11` |
| D3 | AFCA Division III Coaches Poll | `12` |

Each row shows ESPN’s current rank, logo, school, record, and a trend arrow **only when ESPN sent `trend`** (`+3`, `-5`, or `-` for unchanged). Points render when ESPN published `points`; missing points stay blank. Unpublished polls get an empty “not published” state. Rankings are never sampled or filled in.

The header **RANKINGS** nav is on every page. On a phone the poll tabs stick under the header (44px targets, horizontal scroll if needed).

## Team pages

Tap a school name on a scoreboard card or game page to open `/team/{espnId}`. That page loads ESPN’s public team endpoints (same hosts as the scoreboard, no API key):

| Piece | Endpoint | What you see |
| --- | --- | --- |
| Profile | `/teams/{id}` | Name, record, standing, conference, rank |
| Schedule | `/teams/{id}/schedule` | Recent results (W/L + score) and upcoming games |
| Roster | `/teams/{id}/roster` | Jersey, position, class, size — grouped by offense/defense/specialists |

**Gaps:** D2 and NAIA rosters/schedules are often missing on this feed. The page shows a labeled empty state (`ROSTER NOT ON THIS FEED` / `SCHEDULE NOT PUBLISHED`) instead of inventing players or scores. Opponent names on the team page also link through when ESPN published an id.

## Highlights / Reactions strip

The home board shows a swipeable **HIGHLIGHTS / REACTIONS** row under the ESPN red header and above the game grid. It mixes game highlights / big plays with reaction videos for the current college football season.

**Default source (no API key):** public YouTube channel Atom RSS — `https://www.youtube.com/feeds/videos.xml?channel_id=…` — from ESPN College Football, CFB ON FOX, Big Ten Network (highlights) plus Cover 3, Brandon Walker CFB, and Barstool Bench Mob (reactions). Titles that say “reacting” / “highlights” override the channel bucket. Thumbnails use `i.ytimg.com`. Cards open YouTube.

**Optional source:** if `YOUTUBE_API_KEY` is set, `/api/highlights` also searches the YouTube Data API (`college football highlights {year}`, `big plays`, `reaction`) and interleaves those results with RSS. The key is never required.

**Fallback:** if every live source is empty, the strip shows **SAMPLE**-labeled cards that link to YouTube search — not live scores, and never mixed into the ESPN scoreboard.

**Mobile / PWA:** the strip is built for Add to Home Screen first — native horizontal touch swipe, snap scrolling, a peek of the next card, 44px play control, and no hover-only UI. Chevrons appear only on wider screens. The home viewport uses `viewport-fit=cover` so the red header and bottom line clear the notch / home indicator.

**Performance:** the home page server-renders the strip from the same YouTube loader as `/api/highlights`, so thumbnails and titles paint in the HTML even if the browser never hydrates (for example when `next dev` HMR is blocked). The client still refreshes `/api/highlights` every 15 minutes when hydration works. The feed is cached ~2 minutes on the server and does not run inside the scoreboard poll. Thumbnails are `loading="lazy"`.

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
- Open **Rankings** for AP / Coaches / FCS / D2 / D3 and tap a school into its team page
- Open a game for the scorebug, quarter lines, scoring plays, and a drive-by-drive feed (or a clear “no PBP” state)
- Open **DEEP DIVE / SIM** on a game or team page for matchup stats, a simulation range, and prop-feedback cards
- Tap a school name on the board, a game, or a rankings row to open recent scores, the upcoming slate, and the roster
- Swipe the highlights / reactions strip on a phone or installed PWA for current-season YouTube clips
- Watch the bottom-line ticker for the full slate
- Install the board on a phone home screen or pin it as a Windows app

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Server routes proxy ESPN so the browser stays same-origin.
