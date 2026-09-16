# Scrub-to-Film lite v0

Outbound highlight-clip links on Harmon Line gamecast. Not a first-party video player. Not ESPN DRM/stream scrape.

## Goal

From `/game/{id}` scoring plays, scoring PBP rows, and leaders, offer a **CLIP** control that opens a related **YouTube** watch URL in a new tab when the existing highlights feed contains a matching clip. When it does not, show the honest empty **NO CLIP ON THIS FEED** plus a labeled **SEARCH YOUTUBE** results link. `demo: false`. Clip titles and watch URLs are never invented.

## Out of scope

Coach Cam, Momentum Wave beyond the existing X-Ray graph, paid APIs, guaranteed clip match, embedded ESPN film, first-party hosting.

## Architecture

1. **Match** published team names + play/leader text against videos already returned by `loadHighlights` (YouTube RSS and optional Data API). Matching is conservative: both teams in the title, or one team plus a distinctive play/player token. `sample: true` cards are skipped.
2. **Search** builds a YouTube `results?search_query=` URL from the same published strings. That URL is a search page, not a claimed clip.
3. **API** `GET /api/highlights?league=&away=&home=&q=` attaches `{ clip }` via `withClipLookup`. Omitting those params leaves the home-strip payload unchanged.
4. **UI** CLIP chips (≥44px) on scoring plays, scoring PBP rows, and leaders. Match → outbound `watch?v=`. Empty → **NO CLIP ON THIS FEED**. No ESPN `video/clip` hrefs.

## Honesty

| Bucket | Meaning |
| --- | --- |
| Evidence | YouTube title/id/watchUrl copied from the highlights feed. |
| Empty | No feed video matched. Headline **NO CLIP ON THIS FEED**. |
| Search | Outbound YouTube results URL from published team + play text. Not a clip title. |

## Tests

Lib unit tests with fixture videos (no network). Forbidden: invented video ids, ESPN DRM URLs as matches, `demo: true`. Existing Oracle / X-Ray / research / ops / multi-sport tests stay green. `npm test` and `npm run build`.
