# Local favorites / Followed teams hub v0

Browser-only followed teams on The Harmon Line. No account. No demo pins.

## Goal

A `/favorites` hub plus star/pin controls on team and game surfaces. Pins persist in `localStorage` under league-scoped keys from the existing `favoriteKey(league, teamId)` helper so CFB / NFL / MLB (and MBB / NBA) ESPN ids never collide. When pins exist, the home board and bottom-line ticker float those games first. Empty is honest. `demo: false`.

## Out of scope

Service worker, paid odds, merge-to-main, Coach Cam, auth, sync across devices.

## Architecture

1. **Keys** — `favoriteKey("nfl", "2")` → `nfl:2`. Unscoped ids and unknown league slugs are rejected (they must not collapse to CFB).
2. **Store** — `localStorage` key `harmon-line:favorites`. Payload `{ demo: false, pins: FavoritePin[] }`. Corrupt / missing JSON → empty pins, never sample teams.
3. **Pin UI** — star on team pages and on each team row of board cards + Gamecast. 44px targets on phones. Same-tab updates via a custom event; other tabs via `storage`.
4. **Hub** — `/favorites` lists pinned teams grouped by league (current `?league=` first). Unpin in place. Optional “on this slate” games from `/api/scoreboard?league=` filtered to pins; missing slates stay empty.
5. **Board / ticker** — `prioritizeFavoriteGames` stable-partitions favorite-involved games to the front. No pins → original order.

## Honesty

| Bucket | Meaning |
| --- | --- |
| Evidence | Pins the user starred in this browser. Team names/logos copied from the surface they pinned. |
| Empty | No pins → **NO TEAMS PINNED**. No matching slate games → **NO FOLLOWED GAMES ON THIS SLATE**. |
| Forbidden | Invented pins, `demo: true`, collapsing `nfl:2` into `cfb:2`. |

## Tests

Lib unit tests with an in-memory store (no browser). Forbidden: `demo: true`, cross-league id collisions, silent demo pins on bad JSON. Existing standings / Gamecast / multi-sport / ops / oracle / research / Scrub / highlights tests stay green. `npm test` and `npm run build`.
