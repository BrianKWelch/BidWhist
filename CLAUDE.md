# SetPlay / BidWhist — AI Reference Guide

Auto-loaded by Claude Code at the start of every session. Keep this up to date when making structural changes.

---

## What This App Is

SetPlay is a tournament management platform for Bid Whist card tournaments. Two audiences:
- **Admins** (tournament directors): manage teams, schedules, scores, payments, brackets, messages
- **Players**: mobile-optimized portal to enter/confirm scores and view their schedule

Live URL: `https://briankwelch.github.io/BidWhist`
Admin panel: `#/` | Player portal: `#/portal` | Badge scanner (experimental): `#/visitors`

---

## Tech Stack

- **React 18 + TypeScript 5 + Vite 5** (SWC compiler, NOT Babel)
- **shadcn/ui** + **Radix UI** primitives + **Tailwind CSS 3**
- **Supabase** (PostgreSQL + real-time subscriptions)
  - URL: `https://awfupnyqnmkhhihjwtjp.supabase.co`
  - Key: hardcoded in `src/supabaseClient.js` (no .env file)
- **HashRouter** (required for GitHub Pages — all routes use `#/` prefix)
- Build output goes to `docs/` for GitHub Pages serving

Key packages: `recharts`, `react-hook-form`, `zod`, `xlsx`, `tesseract.js`, `date-fns`, `uuid`

---

## Database Schema

> All DB columns are snake_case. Frontend uses camelCase. Both are listed below.

### `tournaments`
| DB column | Frontend | Notes |
|---|---|---|
| `id` | `id` | string PK |
| `name` | `name` | string |
| `cost` | `cost` | number — entry fee per team |
| `boston_pot_cost` | `bostonPotCost` | number |
| `status` | `status` | `'active'` / `'pending'` / `'finished'` / `'not_active'` |
| `tracks_hands` | `tracksHands` | boolean, default true |
| `scoring_mode` | `scoringMode` | `'team'` or `'admin'` |
| `payment_model` | `paymentModel` | `'four_way'` or `'five_way'` |
| `sort_order` | `sortOrder` | `'wins,hands,points'` (configurable priority) |
| `allow_prepay` | `allowPrepay` | boolean |
| `prepaid_cost` | `prepaidCost` | number, default 40 |
| `rotation_type` | `rotationType` | `'standard'` or `'malt'` |
| `malt_rounds` | `maltRounds` | integer — total MALT rounds planned |
| `description` | `description` | string? |

### `players`
`id`, `first_name`, `last_name`, `phone_number`, `city`, `created_at`

### `teams`
| DB column | Frontend | Notes |
|---|---|---|
| `id` | `id` | string PK |
| `name` | `name` | format `"P1First/P2First"` |
| `player1_id` | `player1_id` | FK → players |
| `player2_id` | `player2_id` | FK → players |
| `city` | `city` | |
| `team_number` | `teamNumber` | int? |

Team records are loaded with player join data mapped to legacy fields: `player1FirstName`, `player1LastName`, `player2FirstName`, `player2LastName`, `phoneNumber`, `player1_phone`, `player2_phone`.

### `team_registrations`
`team_id`, `tournament_id` — join table

### `player_tournament`
`id`, `player_id`, `tournament_id`, `paid`, `b_paid`, `entered_boston_pot`, `prepaid`
- `paid` = tournament entry fee paid
- `b_paid` = Boston Pot fee paid
- `entered_boston_pot` = opted into Boston Pot
- `prepaid` = paid at prepay discount rate

### `matches`
| DB column | Frontend | Notes |
|---|---|---|
| `id` | `id` | format: `"{tournamentId}-r{round}-m{n}"` |
| `team_a` | `teamA` | team ID or 'BYE' or placeholder like `"R2W3"` |
| `team_b` | `teamB` | |
| `round` | `round` | int, 1-based |
| `tournament_id` | `tournamentId` | |
| `table_number` | `table` | int |
| `is_bye` | `isBye` | boolean |
| `is_same_city` | `isSameCity` | boolean |

### `games`
> WARNING: This table has mixed camelCase/snake_case column names (historical inconsistency). Always normalize both.

| DB column | Notes |
|---|---|
| `id` | PK |
| `matchId` | FK → matches.id (camelCase in DB!) |
| `teamA`, `teamB` | team IDs (camelCase in DB!) |
| `scoreA`, `scoreB` | numbers |
| `handsA`, `handsB` | numbers |
| `boston_a`, `boston_b` | integers (new) |
| `winner` | `'teamA'` or `'teamB'` |
| `submittedBy` | |
| `confirmed` | boolean |
| `status` | `'entering'` / `'pending_confirmation'` / `'confirmed'` / `'disputed'` |
| `entered_by_team_id` | which team holds the entry lock |
| `round` | int |
| `timestamp` | timestamp |

### `scores`
Secondary score submission table: `id`, `match_id`, `team_a`, `team_b`, `score_a`, `score_b`, `boston` (`'none'`/`'teamA'`/`'teamB'`), `hands_a`, `hands_b`, `submitted_by`, `timestamp`, `round`

### `messages`
`id`, `text`, `type` (`'info'`/`'warning'`/`'success'`/`'error'`), `active`, `created_at`, `expires_at`, `created_by`

### `app_config`
Single row: `id=1`, `active_tournament_id` — partially implemented

---

## Data Flow

### Startup Loading (all parallel)
1. Teams → join players, team_registrations, player_tournament → map payment fields onto team objects
2. Players → sorted by first_name
3. Games → full table, normalize camelCase/snake_case
4. Schedules → matches grouped by tournament_id → TournamentSchedule[]
5. Tournaments → map snake_case columns
6. Messages → ordered by created_at desc

localStorage is **cleared on startup** for teams/schedules/games/scoreSubmissions (prevents stale placeholder data).

### Real-Time Subscriptions
| Table | Handler |
|---|---|
| `games` | Debounced full refetch (100ms) |
| `matches` | Rebuild all schedules from Supabase |
| `scores` | Update scoreSubmissions; auto-confirm if scores match |
| `messages` | Debounced full refetch + 5s polling backup |

### Save Patterns
- **Schedules**: Delete all matches for tournament → bulk insert fresh (atomic replacement)
- **Games**: Upsert by `id` — 'entering' row first, then updated in place to 'pending_confirmation'
- **Tournaments**: `update().eq('id')` → full refetch
- **Teams**: `update().eq('id')` → full refetch including registrations

---

## Key Business Rules

### Score Entry Lock System
1. Click "Score" → `beginScoreEntry` inserts `{status: 'entering', entered_by_team_id}` row in games
2. Lock expires after 5 minutes (stale locks auto-deleted)
3. Returns `{ ok: false, reason: 'conflict' }` if opponent holds lock
4. Submit → row transitions to `'pending_confirmation'`
5. Opponent sees Confirm/Dispute → `'confirmed'` or `'disputed'`
6. Dispute → original submitter can re-enter
7. Retract → deletes the pending row

### Boston Pot
- Team is IN Boston Pot only if **both** players have `entered_boston_pot = true`
- Mismatch = one player in, one out (tracked as `bostonPotMismatch` on team)
- `boston_a` / `boston_b` = integer count of Bostons per game

### City Conflict Logic
Standard rotation avoids same-city pairings. Priority: (1) different city + no rematch, (2) same city allowed, (3) rematch allowed.

### Payment Status
`tournamentPaid` = both player1 AND player2 have `paid = true` for that tournament.

### Results Sorting
Configurable via `sort_order` on tournament: any order of `wins`, `hands`, `points`.
Fixed tiebreakers 4-6: Round 1 points → Round 2 points → team number ascending.

---

## Tournament Modes

### Rotation Types
- **`standard`**: City-aware round-robin (two-column Berger rotation). All rounds generated at once.
- **`malt`**: Movement And Lot Tracker. Rounds generated one at a time after each round completes.

### Scoring Modes
- **`team`**: Players enter scores from portal. Match/dispute resolution flow.
- **`admin`**: Admin enters all scores. Portal shows "Admin Managed."

### Payment Models
- **`four_way`**: 4-way prize split
- **`five_way`**: 5-way prize split

---

## MALT Rotation — Complete Spec

### Formula (`src/lib/maltRotation.ts` → `getMaltNext(numTables, tableNum)`)
```
loser  = ceil(T / 2)
winner = N/2 + ceil(T/2)          // even N
winner = (N+1)/2 + ceil((T-1)/2)  // odd N
```

### Partner Tables
Tables pair as 1&2, 3&4, 5&6, etc. Partner of table T: `T % 2 === 0 ? T - 1 : T + 1`

### Round Generation Flow
1. Admin sets `malt_rounds` on tournament (total rounds planned)
2. Admin clicks "Generate Schedule" → `generateMaltRound1` runs:
   - Generates only Round 1 using city-aware two-column algorithm
   - Saves `malt_rounds` to `tournaments` table
   - Inserts matches to Supabase
3. After round completes, admin clicks "Generate Next Round" → `generateMaltNextRound`:
   - Reads confirmed games, applies formula, inserts next round matches
4. Bye handling: Table 2 winner gets bye → previous bye team takes Table 1 winner slot next round

### Portal Projected Rounds
For ungenerated rounds (beyond what admin has created), the portal projects:
- Uses MALT formula on prior confirmed match to compute next table
- Finds opponent from partner table's confirmed game
- Shows dashed gray "projected" card with TBD where data unavailable

---

## Component Map

### Admin Panel (AppLayout → sidebar tabs)
| Tab | Component | File |
|---|---|---|
| reg-desk | RegistrationDesk | `src/components/RegistrationDesk.tsx` |
| teams | TeamBuilder | `src/components/TeamBuilder.tsx` |
| schedule | TournamentScheduler | `src/components/TournamentScheduler.tsx` |
| results | CombinedResultsPage | `src/components/CombinedResultsPage.tsx` |
| team-report | TournamentTeamReport | `src/components/TournamentTeamReport.tsx` |
| bracket | BracketGenerator | `src/components/BracketGenerator.tsx` |
| finance | FinanceManager | `src/components/FinanceManager.tsx` |
| cities | CityManager | `src/components/CityManager.tsx` |
| messaging | MessageManager | `src/components/MessageManager.tsx` |
| tournament-setup | TournamentManagement | `src/components/TournamentManagement.tsx` |
| quick-scoring | QuickScoreEntry | `src/components/QuickScoreEntry.tsx` (admin mode only) |

### Player Portal
- `src/components/PlayerPortalFixed.tsx` — the entire player-facing portal

### Core Context
- `src/contexts/AppContext.tsx` — all TypeScript interfaces + `useAppContext()` hook
- `src/contexts/AppContextProvider.tsx` — all Supabase queries, state, functions

### Lib
- `src/lib/maltRotation.ts` — `getMaltNext(numTables, tableNum)`
- `src/lib/scheduler.ts` — `generateNRoundsWithByeAndFinal`, city-aware round-robin
- `src/lib/utils.ts` — `getSortedTournamentResults`, general utils
- `src/lib/badgeParser.ts` — OCR text parser (badge scanner feature)

---

## Player Portal Detail

### Login
- Player enters 10-digit phone → searches team by `phoneNumber`/`player1_phone`/`player2_phone`
- Admin access via `#/portal?admin=1` — shows team dropdown and team number input

### Schedule Cards (per match)
| Type | Visual |
|---|---|
| completed win | green border, WIN badge, score |
| completed loss | red border, LOSS badge, score |
| current | blue border, action button or status badge |
| future | white, shows round/opponent/table |
| projected (MALT) | dashed gray, 75% opacity, TBD placeholders |
| BYE | yellow border |

### Score Entry Steps (modal)
Steps when `tracksHands=true`: your points → your hands → your bostons → opponent points → opponent hands → opponent bostons → tie resolution
Steps when `tracksHands=false`: skip hands steps (5 total instead of 7)

### MALT-specific portal features
- "Go to Table N" badge after completed matches (computed from formula or reads next scheduled match)
- "View N-Table Rotation Chart" button → modal with full rotation table

---

## AppContext Key Functions (most-used)

```typescript
// Teams
addTeam(p1First, p1Last, p2First, p2Last, phone, city, selectedTournaments, bostonPotTournaments)
updateTeam(updatedTeam)
refreshTeams()

// Tournaments
updateTournament(id, name, cost, bostonPotCost, desc?, status?, tracksHands?, scoringMode?, paymentModel?, sortOrder?, allowPrepay?, rotationType?, maltRounds?)
setActiveTournament(tournamentId)
getActiveTournament() → Tournament | null

// Schedules
saveSchedule(schedule)          // replaces all matches for tournament
generateMaltNextRound(tournamentId)
generateMaltMakeupRound(tournamentId)

// Score/game flow
beginScoreEntry({matchId, teamId, teamA, teamB, round})  → { ok, reason? }
submitGame(gameData)
confirmScore(gameId, confirm: boolean)
retractScore(gameId, teamId)

// Payments
updatePlayerPayment(playerId, tournamentId, isPaid, isBostonPot)
```

---

## Deployment

```bash
npm run dev       # Vite dev on port 8080
npm run build     # Production build → docs/
git add docs/ && git commit -m "Deploy production build"
git push          # GitHub Pages auto-serves from docs/
```

**Never push without explicit user approval after local testing.**

---

## Feed the Fat Man (standalone side project)

A self-contained arcade game, unrelated to tournament management. Source of
truth is `public/fatman/`; Vite copies `public/` verbatim into `docs/`, so
`docs/fatman/` is the deployed copy — keep the two in sync if you edit it
without running a build.

- URL: `https://briankwelch.github.io/BidWhist/fatman/`
  (`/fatman.html` is a redirect stub kept for older links.)
- Deliberately **outside** the React app: it does not import React, Tailwind,
  Supabase or `AppContextProvider`, so it loads instantly on a phone and cannot
  affect the live tournament app. Do not "fix" this by porting it into `src/`.
- Not linked from any admin or portal screen — reached by URL only.
- `index.html` is one file, plain HTML/CSS/JS in an IIFE. State machine:
  `title → intro → play → clear → over`. Round types live in the `TYPES` map;
  `pickType(round)` picks one and `tuned(type, round)` layers the per-round
  difficulty creep on top.

### Why it lives in a subfolder (important)

It is an installable PWA: `sw.js` precaches the game so it plays fully offline.
A service worker's default scope is its own directory, so a worker at
`/fatman.html` would have claimed **all of `/BidWhist/`** and started
intercepting and caching the tournament app. Keeping the game in `/fatman/`
seals the worker's scope to that folder. Never move `sw.js` up a level.

**Bump `CACHE` in `sw.js` whenever you change the game**, or installed phones
will keep serving the old cached copy.

---

## Quick Draw Trivia (standalone side project)

A two-player speed-trivia game. Same rules as Feed the Fat Man: source of truth
is `public/trivia/`, `docs/trivia/` is the deployed copy, keep the two in sync.

- URL: `https://briankwelch.github.io/BidWhist/trivia/`
- Deliberately **outside** the React app — no React, Tailwind, Supabase or
  `AppContextProvider`. Not linked from any admin or portal screen.
- Its `sw.js` scope is sealed to `/BidWhist/trivia/` for the same reason
  fatman's is. Never move it up a level, and **bump `CACHE` on every change**.

### How two phones connect (the important part)

There is no server and no internet. The two phones talk over a **WebRTC data
channel** carried by whatever local network they share — home Wi-Fi, a hotspot,
a hotel AP. What a signalling server normally does (swap session descriptions)
is done by the **cameras**: each phone renders its description as a QR code and
scans the other's.

- `packSdp()` / `unpackSdp()` in `app.js` are the reason this works. A raw
  data-channel SDP is ~1.5 KB — too dense to scan. `packSdp` keeps only the
  five fields that actually vary (ICE ufrag, ICE pwd, DTLS fingerprint, DTLS
  role, candidate list) and `unpackSdp` rebuilds the rest from a fixed
  template. Payload lands around 100 chars.
- **If you change the SDP template, change both sides together.** They are a
  matched pair; a field added to one and not the other silently breaks pairing.
- IPv6 candidates are filtered out on purpose — they roughly double the QR
  density for a case a LAN or hotspot never needs.
- The app asks for the camera *before* creating the offer. That is not just for
  scanning: once a page holds a media permission Chrome stops masking host
  candidates behind mDNS `.local` names, which makes the direct connection much
  more likely to come up.

### Version skew is a first-class hazard

Both phones must build byte-identical rounds, which holds only if they run the
same round-building code *and* the same question bank. A phone serving a stale
cached build once paired happily and then played an entirely different set of
questions from the one the wheel landed on — silently, with no error.

Guards now in place, all covered by the self-test:

- `APP_VERSION` = `'p' + PROTO + '.' + bankVersion()`. `PROTO` is bumped by hand
  whenever round building or the message shape changes; the bank half hashes
  every question tuple, so editing `questions.js` changes it automatically.
- It is exchanged in the `hi` message. A build old enough to send no `v` field
  reads as `'legacy'` and mismatches. On mismatch both the category picker and
  the inbound `start` handler refuse, so neither side can begin a round —
  important because the *older* phone knows nothing about any of this and will
  still try to host.
- `start` also carries `roundSum()` of the host's built round; the joiner
  rebuilds and compares, catching any divergence two equal-versioned builds
  might still manage.
- The lobby offers "Update this phone", which deletes the caches, unregisters
  the worker and reloads — a guaranteed way out of a stale build.

**So: bump `CACHE` in `sw.js` on every change, and bump `PROTO` whenever round
building or the wire format changes.**

### Service worker update path

`register()` passes `updateViaCache:'none'` so `sw.js` is never served from HTTP
cache. When a new worker reaches `activated` the page reloads once to pick up
the new scripts, guarded by a `wasControlled` flag captured at load time —
`clients.claim()` sets `navigator.serviceWorker.controller` during a *first*
install too, so checking it later would reload every new visitor.

### Known environment limits

- **iPhone Personal Hotspot cannot run in Airplane Mode** (it needs the cellular
  radio), so the "play it on a plane" case depends on the aircraft's own Wi-Fi,
  and many airline APs enable client isolation which blocks phone-to-phone
  traffic. Solo mode is the documented fallback; the in-app "How it works"
  screen says all of this.
- Both phones must precache the PWA *before* going offline.

### Categories and the wheel

The host picks what the round is about before it starts; the joiner waits in the
lobby and is told a pick is happening. `CATS` in `app.js` is the nine-category
list **and** the wheel's segment order, so changing it changes where the wheel
lands — keep it stable. `MIXED` draws from the whole bank.

- The **R&B Lyrics** category is finish-the-line. Quoted fragments are kept
  deliberately short — the hook or title line, a handful of words — and answers
  are one word wherever possible. Reproducing verses or full choruses would be
  a licensing problem; a short identifying fragment in a quiz is not. Keep to
  that discipline when adding to it. (Playing clips of commercial recordings is
  a different matter entirely and is not something this game can ship: there is
  no legal source of recognisable R&B audio, and anything added to the repo is
  published by GitHub Pages.)
- `buildRound(seed, cat)` filters the bank by category before shuffling. The
  pool is built in bank order so both phones filter identically. A category
  thinner than a full round tops up from the whole bank rather than short-
  changing the round, and silently stops being the category that was picked.
  **Every category carries 50 questions; keep them balanced when editing.** At
  50, two back-to-back rounds of the same category share about 2 questions of
  10 — at 20 it was 5 of 10, which players noticed as repetition. The self-test
  fails any category that drops below a full round's worth.
- "Surprise me" spins a wheel on **both** phones. The host decides the landing
  category, then sends `{t:'start', seed, cat, spin:true}`; both sides derive
  the turn count and jitter from that same seed, so the animation matches.
  Nothing about the spin is negotiated after the fact.
- `CATS` is folded into `APP_VERSION` alongside the bank hash, because its
  order decides which wheel segment a category maps to. Reordering it without
  touching `questions.js` would otherwise pass the skew check and send the two
  phones to different segments.
- `presentCategory()` doubles as the reveal for a direct pick — it holds the
  category name for a beat so the other phone sees what is coming.

Two CSS class names are load-bearing here and have bitten once each: the picker
tiles are scoped as `.cats .cat` because `.cat` is also the in-game category
label inside `.meta`, and the random tile is `.cat.rand` because `.spin` is
already the loading spinner. Both collisions rendered visibly wrong.

### Game rules

10 questions, 4 options, 15s each. `points = max(100, 1000 x (1 - elapsed/15s))`
when correct, 0 otherwise. Both phones derive the identical question list and
option shuffle from one seed the host broadcasts, so scoring is computed locally
on each side rather than round-tripped. Each phone times its own player from
when *it* rendered the question, so LAN latency cannot skew the result.

### Vendored libraries

`jsQR.js` (Apache-2.0) decodes, `qrcode.js` (MIT) encodes. Both are minified
upstream releases; attributions are in `VENDOR-LICENSES.txt`.

### Tests

`tools/trivia-selftest.cjs` drives two real browser contexts through the full
pairing handshake (via the app's paste fallback, so no camera is needed) and
plays a complete round, asserting both phones agree on every score. It is not
wired into npm scripts because Playwright is not a project dependency:

```bash
npm i --no-save playwright && npx playwright install chromium
node tools/trivia-selftest.cjs
```

`window.__qd` exposes `packSdp`, `unpackSdp`, `buildRound`, `points` and the
live `G`/`P` state so the harness can drive the game without a camera. Chromium
needs `--disable-features=WebRtcHideLocalIpsWithMdns` (the harness passes it)
for candidates to resolve in a container.

---

## Gotchas & Known Quirks

1. **`games` table has mixed camelCase/snake_case columns** — always handle both: `g.teamA ?? g.team_a`, `g.handsA ?? g.hands_a`
2. **`schedule.rounds` is computed from `Math.max(match.round)`** — it's always the highest generated round, not the total planned rounds. Use `tournament.maltRounds` for total planned.
3. **`id` column on `tournaments` is TEXT** — always use string literals in WHERE clauses: `WHERE id = '4'`, not `WHERE id = 4`
4. **Import `supabaseClient` without extension** — `import('../supabaseClient')`, NOT `import('../supabaseClient.js')`
5. **Static `import` vs dynamic `import()`** — many components use dynamic `import('../supabaseClient')` to lazy-load. This is fine; don't "fix" it.
6. **`app_config` is partially implemented** — active tournament is primarily determined by `tournaments.status === 'active'`, not `app_config`
7. **localStorage cleared on startup** — do not rely on localStorage for cross-session data; use Supabase
8. **HashRouter required** — GitHub Pages has no server-side routing; all navigation must use `#/` prefixed routes
9. **`docs/` is the build output** — it's committed to git; rebuild and commit `docs/` to deploy
10. **Score entry lock expires in 5 minutes** — stale `'entering'` rows are automatically cleaned up when a new entry attempt is made
