# The Harmon Line

Nostalgic ESPN-style live scoreboard for **Christian Harmon**. The home board is **college football** (NCAA D1 FBS + FCS, D2, and partial NAIA). Men’s college basketball (NCAA D1), the **NFL**, the **NBA**, and **MLB** are first-class siblings via the header switcher (`?league=mbb`, `?league=nfl`, `?league=nba`, `?league=mlb`). College football stays the default when `league` is omitted. Public ESPN scoreboard/summary feeds — no API key.

## Run locally

```bash
npm install
npm run dev
```

Unit checks for period scores, subdivision labels, poll-clock timezone, week/date mapping, and redirect hosts:

```bash
npm test
```

Open [http://localhost:43173](http://localhost:43173). The home board defaults to **today’s college football games in US/Eastern**, with a week strip to jump ESPN regular-season weeks. Click any game for a detail page with scoring, leaders, and play-by-play when ESPN publishes it. **Rankings** (`/rankings`) lists AP, Coaches, FCS, D2, and D3 football polls from the same public ESPN JSON.

### Switch sports (CFB ↔ MBB ↔ NFL ↔ NBA ↔ MLB)

College football stays the default Saturday home. Men’s college basketball, the NFL, the NBA, and MLB are on the same app via `?league=mbb` / `?league=nfl` / `?league=nba` / `?league=mlb` (or the **CFB / MBB / NFL / NBA / MLB** chips in the red header).

| Surface | CFB (default) | MBB | NFL | NBA | MLB |
| --- | --- | --- | --- | --- | --- |
| Scoreboard | `/` — week chips + Eastern date | `/?league=mbb` — **date arrows only** (`?dates=YYYYMMDD` on ESPN). No football week chips. | `/?league=nfl` — **week-first** (`?week=&year=&seasontype=`). Regular season by default; pre/post chips only if ESPN’s calendar already published them. | `/?league=nba` — **date arrows only** (`?dates=YYYYMMDD`). No week chips, no college groups. | `/?league=mlb` — **date arrows only** (`?dates=YYYYMMDD`). No week chips, no college groups. |
| Game | `/game/{espnId}` | `/game/{espnId}?league=mbb` — boxscore TEAM STATS / player cats, **plays** PBP (not drives), news links. No Deep Dive / odds / ATS. | `/game/{espnId}?league=nfl` — football situation, drives, scoring plays, TEAM STATS / player box, standings snippet, outbound news. No Deep Dive / CFBD / odds / pickcenter / winprob. | `/game/{espnId}?league=nba` — boxscore TEAM STATS / player BOX, **plays** PBP (quarters, not football drives), outbound news. Honest empty when ESPN omitted a module. No Deep Dive / odds / pickcenter / winprob / ATS. | `/game/{espnId}?league=mlb` — boxscore TEAM STATS / player BOX, **plays** / **atBats** PBP, **inning linescores** (extras only if ESPN published them). Honest empty when ESPN omitted a module. No Deep Dive / odds / pickcenter / winprob / ATS. |
| Rankings | `/rankings` | `/rankings?league=mbb` — AP and Coaches when ESPN publishes them; honest empty out of season. | Hidden — ESPN `/rankings` **404s**. No invented polls. | Hidden — ESPN `/rankings` **404s**. No invented polls. | Hidden — ESPN `/rankings` **404s**. No invented polls. |
| Team | `/team/{espnId}` | `/team/{espnId}?league=mbb` (same NCAA ids as football — always pass `league`) | `/team/{espnId}?league=nfl` (NFL ids — always pass `league`; favorites keys if added later are `{league}:{teamId}`) | `/team/{espnId}?league=nba` (NBA ids — always pass `league`; favorites keys `{league}:{teamId}`) | `/team/{espnId}?league=mlb` (MLB ids — always pass `league`; favorites keys `{league}:{teamId}`) |

Open the MLB board at [http://localhost:43173/?league=mlb](http://localhost:43173/?league=mlb). Jump a night with `/?league=mlb&date=20260915`. Open the NBA board at [http://localhost:43173/?league=nba](http://localhost:43173/?league=nba). Jump a night with `/?league=nba&date=20260415`. Open the NFL board at [http://localhost:43173/?league=nfl](http://localhost:43173/?league=nfl). Jump a published week with `/?league=nfl&week=2&year=2026&seasontype=2`. Scores and poll points are never invented.

September MBB slates are often empty. Jump the date (for example `/?league=mbb&date=20251115`) rather than expecting a football-style week strip. NBA and MLB are the same date-first pattern — use `/?league=nba&date=YYYYMMDD` or `/?league=mlb&date=YYYYMMDD` for a published night.

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
| `ESPN_WEB_BASE` | no | Primary public **host** (defaults to `https://site.web.api.espn.com`). Sport/league is appended from the registry. |
| `ESPN_SITE_BASE` | no | Fallback **host** (`https://site.api.espn.com`). |
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

`GET {ESPN_WEB_BASE|ESPN_SITE_BASE}/apis/site/v2/sports/football/college-football/rankings`

Example: `https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/rankings` (fallback `site.api.espn.com`).

| Tab | ESPN poll | Typical ESPN `id` |
| --- | --- | --- |
| AP | AP Top 25 | `1` (`type: ap`) |
| COACHES | AFCA Coaches Poll | `2` (`type: usa`) |
| FCS | FCS Coaches Poll | `20` (`type: fcs`) |
| D2 | AFCA Division II Coaches Poll | `11` |
| D3 | AFCA Division III Coaches Poll | `12` |

Each row shows ESPN’s current rank, logo, school, record, and a trend arrow **only when ESPN sent `trend`** (`+3`, `-5`, or `-` for unchanged). Points render when ESPN published `points`; missing points stay blank. Unpublished polls get an empty “not published” state. Rankings are never sampled or filled in.

The header **RANKINGS** nav is on CFB and MBB pages. NFL, NBA, and MLB hide it — ESPN’s public rankings JSON 404s, and this app does not invent polls. On a phone the poll tabs stick under the header (44px targets, horizontal scroll if needed).

## Ops / agent graph

`/ops` is a hub-and-spoke **agent map on the board** (not a separate product). Header **OPS** sits next to SCOREBOARD / RANKINGS. The sport switcher still jumps CFB / MBB / NFL / NBA / MLB boards.

| Piece | v0 |
| --- | --- |
| Hub | **Chief Keef** — orchestrator mark. Subtle radar pulse when any active node is busy. |
| Spokes | **The Board** (live scoreboard), **CFB Edge** (retired / skip), **Lab** (skip). Idle dim, busy bright. |
| Edges | Thin hub↔spoke lines. Particle / dash pulse only when that spoke is busy. |
| Feed | Static roster. **Live agent-status is not connected.** `/api/ops` returns the same payload (`demo: false`, `liveFeed: false`). |
| Dogfood | `?busy=board`, `?busy=hub`, or `?busy=all` (and chips on the page) light nodes without claiming a live feed. Retired/skip spokes stay dim. |

No PnL, Polymarket, Monte Carlo dollars, win probability, or paid-odds chrome. Scores stay on the scoreboard.

Open [http://localhost:43173/ops](http://localhost:43173/ops). Try [http://localhost:43173/ops?busy=board](http://localhost:43173/ops?busy=board) to see The Board bright with edge traffic.

## Stat Oracle lite v0

`/oracle` is a natural-language situational Q&A box over **public ESPN** summary / scoreboard / rankings JSON already used by the boards (optional CFBD season stats when `CFBD_API_KEY` is set). Header **ORACLE** sits next to SCOREBOARD / RANKINGS / OPS. Game pages, team pages, and CFB Deep Dive chrome also link in with `gameId` / `teamId` so answers ground on that payload.

| Piece | v0 |
| --- | --- |
| UI | `/oracle` (and `?league=&gameId=&teamId=&q=`) — ESPN red/gold, Evidence vs Inference panels, 44px Ask control |
| API | `GET`/`POST` `/api/oracle` — `{ question, league?, gameId?, teamId? }` → structured answer, **`demo: false`** |
| Evidence | Observed cells only (score, record, rank, leaders, situation, published PPG). Blank → “not on this feed” |
| Inference | Model narrative with **INFERENCE** / **SIMULATION** badges. No invented percentiles, sample sizes, or scores |
| Betting | No odds / winprob / pickcenter / ATS. Betting-adjacent language gets the Deep Dive **1-800-GAMBLER** disclaimer |
| CFBD | Optional fill of blank ESPN season-stat cells when `CFBD_API_KEY` is set; labeled in Evidence |

Open [http://localhost:43173/oracle](http://localhost:43173/oracle). Try [http://localhost:43173/oracle?q=What%27s%20the%20score](http://localhost:43173/oracle?q=What%27s%20the%20score) or pass `gameId` from a live card.

## Week / schedule nav

The home board is still Eastern-date based by default (`?date=YYYYMMDD`), but a swipeable **WEEK** chip strip lets you jump the way ESPN’s scoreboard URL does: `/_/week/N/year/YYYY/seasontype/2`.

| Harmon query | ESPN public JSON (same hosts as the scoreboard) |
| --- | --- |
| `/?date=20260915` | `/scoreboard?groups=80&dates=20260915&limit=300` (that Eastern day; D1 FBS example) |
| `/?week=3&year=2026&date=20260914` | `/scoreboard?groups=80&week=3&seasontype=2&dates=2026&limit=300` (that week’s published CFB slate) |
| `/?league=nfl` | `/scoreboard?limit=300` (ESPN’s current NFL week; no college `groups`) |
| `/?league=nfl&week=2&year=2026&seasontype=2` | `/scoreboard?week=2&seasontype=2&dates=2026&limit=300` |

Week chips come from ESPN’s scoreboard `leagues[0].calendar`. **CFB v0 is regular season only** (`seasontype=2`); preseason, bowls, and off-season buckets are ignored. **NFL** reuses the same strip and also surfaces preseason / postseason chips **only when ESPN already returned those calendar entries** — empty off-season buckets are skipped, never invented. Picking a week loads ESPN’s published slate and sets the Eastern date to that week’s start so date arrows stay coherent. Shifting the date drops week mode and shows that day’s games. Empty weeks are labeled empty — games and scores are never invented.

## Team pages

Tap a school name on a scoreboard card or game page to open `/team/{espnId}`. That page loads ESPN’s public team endpoints (same hosts as the scoreboard, no API key):

| Piece | Endpoint | What you see |
| --- | --- | --- |
| Profile | `/teams/{id}` | Name, record, standing, conference, rank |
| Schedule | `/teams/{id}/schedule` | Recent results (W/L + score) and upcoming games |
| Roster | `/teams/{id}/roster` | Jersey, position, class, size — grouped by offense/defense/specialists |

**Gaps:** D2 and NAIA rosters/schedules are often missing on this feed. The page shows a labeled empty state (`ROSTER NOT ON THIS FEED` / `SCHEDULE NOT PUBLISHED`) instead of inventing players or scores. Opponent names on the team page also link through when ESPN published an id.

## Highlights / Reactions strip

Every shipped home board (CFB default, plus `?league=mbb|nfl|nba|mlb`) shows a swipeable **HIGHLIGHTS / REACTIONS** row under the ESPN red header and above the game grid. The feed is keyed off the active `league` (header switcher or `?league=`). Switching sports SSR-renders that sport’s clips and the client refreshes `/api/highlights?league=`. Game, Rankings, and team pages do not show the strip.

**Default source (no API key):** public YouTube channel Atom RSS — `https://www.youtube.com/feeds/videos.xml?channel_id=…` — from sport-specific highlight and reaction channels (ESPN College Football / CFB ON FOX / Big Ten Network + Cover 3 for CFB; March Madness / Field of 68 for MBB; NFL / NFL Network + Pat McAfee / Pardon My Take for NFL; NBA / NBA on ESPN + House of Highlights for NBA; MLB / MLB Network + Talkin’ Baseball / Jomboy for MLB). Titles that say “reacting” / “highlights” override the channel bucket. Clips from another sport are dropped, not relabeled. Thumbnails use `i.ytimg.com`. Cards open YouTube.

**Optional source:** if `YOUTUBE_API_KEY` is set, `/api/highlights?league=` (default `cfb`) also searches the YouTube Data API with league-scoped queries (`college football highlights {year}`, `nba highlights {year}`, …) and interleaves those results with RSS. The key is never required. The payload is always `demo: false`.

**Empty:** if a league has no current-season clips, the strip shows a labeled empty (`{SPORT} HIGHLIGHTS NOT ON THIS FEED`). Video ids and titles are never invented, and CFB clips are never shown on NBA/NFL/MBB/MLB.

**Mobile / PWA:** the strip is built for Add to Home Screen first — native horizontal touch swipe, snap scrolling, a peek of the next card, 44px play control, and no hover-only UI. Chevrons appear only on wider screens. The home viewport uses `viewport-fit=cover` so the red header and bottom line clear the notch / home indicator.

**Performance:** the home page server-renders the strip from the same YouTube loader as `/api/highlights`, so thumbnails and titles paint in the HTML even if the browser never hydrates (for example when `next dev` HMR is blocked). The client still refreshes `/api/highlights?league=` every 15 minutes when hydration works. The feed is cached ~2 minutes on the server and does not run inside the scoreboard poll. Thumbnails are `loading="lazy"`.

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

- Filter D1 / D2 / NAIA, plus FBS vs FCS on Division I (CFB)
- Jump ESPN regular-season weeks from the CFB home-board week strip, or shift the Eastern date
- Switch to **MBB** from the header chips (or `?league=mbb`) for a D1 basketball date board
- Switch to **NFL** from the header chips (or `?league=nfl`) for a 32-team week board (AFC / NFC filters)
- Switch to **NBA** from the header chips (or `?league=nba`) for a date-first NBA board
- Switch to **MLB** from the header chips (or `?league=mlb`) for a date-first MLB board
- Filter by conference, live/upcoming/final, team search, and date
- Open **Rankings** for CFB AP / Coaches / FCS / D2 / D3, or MBB AP / Coaches, and tap a school into its team page (NFL, NBA, and MLB have no rankings page)
- Open a CFB or NFL game for the scorebug, quarter lines, scoring plays, and a drive-by-drive feed (or a clear “no PBP” state)
- Open an MBB game for halves, TEAM STATS / player box, scoring, and a plays PBP (or a clear empty state)
- Open an NBA game for quarters, TEAM STATS / player box, scoring, and a plays PBP (or a clear empty state)
- Open an MLB game for inning linescores, TEAM STATS / player box, scoring, and a plays/at-bats PBP (or a clear empty state). Extra innings and doubleheaders appear only when ESPN published them.
- Open **DEEP DIVE / SIM** on a CFB game or team page for matchup stats, a simulation range, and prop-feedback cards (CFB only — not on NFL, MBB, NBA, or MLB)
- Tap a school or NFL club name on the board, a game, or a rankings row to open recent scores, the upcoming slate, and the roster
- Swipe the highlights / reactions strip on a phone or installed PWA for current-season YouTube clips (every home board; keyed off `league`)
- Open **OPS** for the hub-and-spoke agent map (static roster; live status feed is not connected)
- Open **ORACLE** (`/oracle`) and ask a situational question; answers split Evidence (observed ESPN/CFBD cells) vs Inference (badged model narrative), or an honest empty
- Watch the bottom-line ticker for the full slate
- Install the board on a phone home screen or pin it as a Windows app

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Server routes proxy ESPN so the browser stays same-origin.

## Phase 0 — sport-agnostic ESPN registry (foundation)

The fetch layer is parameterized by a `SportLeague` registry. Host-only `ESPN_WEB_BASE` / `ESPN_SITE_BASE` plus `sports/{sport}/{league}`. `/api/scoreboard?league=` and game detail `league` default to `cfb` so existing football clients omit the param.

## Phase 1 — men’s college basketball (MBB) v0

MBB is the first second-sport UI on that registry. CFB remains the default home and is unchanged (week strip, Rankings, Gamecast, Deep Dive, highlights).

| Piece | Status |
| --- | --- |
| CFB scoreboard, week strip, Rankings, Gamecast, Deep Dive, team pages, highlights SSR, PWA | Unchanged — default home |
| Registry | `cfb` + `mbb` + `nfl` + `nba` + `mlb` shipped |
| MBB scoreboard | `/?league=mbb` — ESPN `basketball/mens-college-basketball`, **group 50** (D1), `limit=400`, date nav |
| MBB game | `/game/{id}?league=mbb` — TEAM STATS, player cats when present, flat `plays[]` PBP, outbound news. No football drives/situation, no odds/winprob/ATS/pickcenter, no Deep Dive |
| MBB rankings | `/rankings?league=mbb` — AP (`id` 1) and Coaches (`id` 2 / `type` usa) when ESPN publishes them |
| Sport switcher | Header **CFB** / **MBB** / **NFL** / **NBA** / **MLB** links |
| Logos | NCAA namespace for MBB (same as CFB) |
| API | `league=mbb` returns a real scoreboard (`demo: false`) |

**Deferred:** D2/NAIA basketball; MBB Deep Dive/props; odds on cards.

## Phase 2 — NFL v0

NFL is the second sibling sport on the Phase 0 registry. CFB remains the default home (week strip, Rankings, Gamecast, Deep Dive, highlights). MBB `?league=mbb` is unchanged.

| Piece | Status |
| --- | --- |
| Registry | `nfl` shipped (`football` / `nfl`, week nav, `nfl/500` logos, drives + situation, `rankings: false`) |
| NFL scoreboard | `/?league=nfl` — week-first, `?week=&year=&seasontype=`, no college groups. AFC / NFC chips from ESPN standings ids 8 / 7 |
| NFL game | `/game/{id}?league=nfl` — situation, drives, scoring, TEAM STATS, player box, standings snippet, outbound news. Honest empty when ESPN omitted a module. No Deep Dive / CFBD / odds / pickcenter / winprob / ATS |
| NFL rankings | Hidden in the header. `/rankings?league=nfl` is an honest empty (ESPN 404) — polls are never invented |
| Logos | `https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png` |
| Favorites keys | `{league}:{teamId}` helper so NFL `2` (Bills) is not CFB `2` |

**Deferred:** CFB `/standings` hub; favorites UI; service worker; betting chrome.

## Phase 3 — NBA v0

NBA is the third sibling sport on the Phase 0 registry. CFB remains the default home (week strip, Rankings, Gamecast, Deep Dive, highlights). MBB `?league=mbb` and NFL `?league=nfl` are unchanged.

| Piece | Status |
| --- | --- |
| Registry | `nba` shipped (`basketball` / `nba`, date nav, `nba/500` logos, plays PBP, `rankings: false`) |
| NBA scoreboard | `/?league=nba` — date-first, `?dates=YYYYMMDD`, no college groups, no week chips |
| NBA game | `/game/{id}?league=nba` — TEAM STATS, player box, scoring, flat `plays[]` PBP (quarters). Honest empty when ESPN omitted a module. No football drives/situation, no Deep Dive / odds / pickcenter / winprob / ATS |
| NBA rankings | Hidden in the header. `/rankings?league=nba` is an honest empty (ESPN 404) — polls are never invented |
| Logos | `https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png` |
| Favorites keys | `{league}:{teamId}` so NBA `13` (Lakers) is not CFB `13` |

**Deferred:** CFB `/standings` hub; favorites UI; service worker; betting chrome.

## Phase 4 — MLB v0

MLB is the fourth sibling sport on the Phase 0 registry. CFB remains the default home (week strip, Rankings, Gamecast, Deep Dive, highlights). MBB `?league=mbb`, NFL `?league=nfl`, and NBA `?league=nba` are unchanged.

| Piece | Status |
| --- | --- |
| Registry | `mlb` shipped (`baseball` / `mlb`, date nav, `mlb/500` logos, plays + atBats PBP, `rankings: false`) |
| MLB scoreboard | `/?league=mlb` — date-first, `?dates=YYYYMMDD`, no college groups, no week chips |
| MLB game | `/game/{id}?league=mlb` — TEAM STATS, player box, scoring, **plays** / **atBats** PBP, **inning linescores**. Extra innings and doubleheaders only if ESPN published them. Honest empty when ESPN omitted a module. No football drives/situation, no Deep Dive / odds / pickcenter / winprob / ATS |
| MLB rankings | Hidden in the header. `/rankings?league=mlb` is an honest empty (ESPN 404) — polls are never invented |
| Logos | `https://a.espncdn.com/i/teamlogos/mlb/500/{abbr}.png` |
| Favorites keys | `{league}:{teamId}` so MLB `15` (Yankees) is not CFB `15` |

**Deferred:** CFB `/standings` hub; favorites UI; service worker; betting chrome; inventing doubleheader grouping.

All registered leagues ship with `demo: false` and coverage notes. Scores are never invented.
