# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- Creating an event (or carrying one over) goes straight to the organiser page. The interstitial that showed the organiser link and recovery secret is gone, and so is the recovery form: control belongs to the browser that created the event, and moves by handover.
- Buttons have a lighter background so they stand out from the page; the timeline's genre stripes are drawn again on every browser (segments are no longer `<button>` elements, whose layout Safari ignores); the break's time range above the bar is gone, only its minutes and the remove button remain.
- Organiser console: Playing + queue, the QR code and the rest (player, hand over, time, rules, end) are three pages to swipe between sideways, replacing the bottom tab bar, so scrolling the queue no longer affects them. Pause and Resume are icons. The queue has its own blue-grey background.
- The footer is a single thin, small block (about a quarter of its former height), with Docs and Source inline.
- Timeline gestures: tap a part of the bar to select it; press and hold a part to add a break in its middle (snapped to the 10-minute grid). Breaks are dragged as a whole, and only the end handle changes their length (the start handle is gone). Minutes are written above every break and every part. Breaks still cannot touch (at least 20 minutes of music between them).
- Time stamps sit above the timeline (in a fixed-height row, so selecting a break never moves the bar); the "h:mm" caption under the time wheel is gone.
- Breaks are royal purple (was sky blue).
- Style selectors show the style's name inside a box whose thick border is its colour (striped for non-Latin); unselected boxes fade border and text together. The same boxes are used when an attendee picks a style for a song.
- Wheel pickers settle faster: the value follows the wheel live, and the rest position is confirmed on `scrollend` (fallback 40 ms, was 90 ms).
- Header: the menu is a three-line icon holding Docs, Privacy and Source (plus session rules on event pages); light/dark is a sun/moon toggle beside it.

## [0.3.0] - 2026-10-29

### Added
- Wheel pickers (drums with fade-away rows) for planned time (quarter hours, default 2:00), most songs in a row, songs per person and ratio parts; the ratio defaults to an equal split.
- Visual timeline: the evening as one bar of fixed width; tap to add a break (10-minute grid), drag handles to move or resize, limits enforced while dragging.
- Rules per part of the evening: each part between breaks has its own styles and ratio; new parts copy the part they split.
- Colour-coded genres with a thin white outline (red salsa, black bachata, orange cha-cha, grey Other, stripes for non-Latin); swatches replace most style text.
- "Other (Musicality Exercise)" style; style grid with Latin styles on the left and non-Latin counterparts across.
- Generated event names (three neutral words); no name is repeated until all permutations are used, and consecutive names share no word.
- Playlists per style: one per style, every active genre needs one (a Latin style's playlist covers its non-Latin counterpart and vice versa); songs interleaved and cut to the planned time minus one minute.

### Changed
- Event names can no longer be typed; the create request rejects a `name`.
- Planned time moves in quarter hours (was ten-minute steps); breaks are placed by tapping the bar (was evenly spread automatically).
- Default styles are salsa and bachata with their non-Latin versions; cha-cha is an extra.
- Rules snapshot is version 3.

### Removed
- Break-adding buttons, number inputs and the event name field on the create screen.

## [0.2.0] - 2026-10-29

Changes from the first pilot feedback.

### Added
- Six dance styles in three genres (salsa, bachata, cha-cha, each with a non-Latin-compatible variant); style changes and run caps count per genre. One master "most songs in a row" number, with an optional ratio (parts 1–5) and a hard floor of 1 part in 10 per genre.
- Single-genre spacing: a returning requester waits for half of the other people's waiting songs.
- Planned time like an oven timer (hours up to 8, minutes in steps of 10); breaks (10/20/30 min, at most 3) centred on the planned time, at most half of it, never back to back, shown in the attendee queue; songs never run into a break.
- Playlist import: start an event from a public Spotify, YouTube Music/YouTube or Apple Music playlist link, queued up to one minute less than the planned time.
- Joining needs the secret in the organiser's QR code; a room code alone no longer joins.
- Landing page with six single-character code boxes (auto-advance, paste, backspace), header with the logo (home link) and a menu with session rules and theme.
- Organiser console that fits one screen (Queue / Invite / Player / More tabs; only the queue scrolls).
- Right-click and text selection are disabled on organiser, attendee and player pages (a deterrent).

### Changed
- Ending an event is two distinct taps with nothing to type.
- The organiser screen shows only the QR code: no room code, join link or copy button.
- Carry-over keeps the previous planned time and fits songs within it minus one minute.
- Rules snapshot is version 2.

### Removed
- Pasting or uploading a JSON export to start an event, and the JSON download on past events.
- Kizomba, merengue and "other" styles; free-form planned end time at creation; creation templates.

## [0.1.0] - 2026-10-29

First release, ready for the pilot.

### Added
- Monorepo scaffold (pnpm workspaces, strict TypeScript, ESLint, Prettier).
- `@qroove/config` with brand, style presets and rule defaults.
- Fastify server with `/api/health`, static hosting for the web app and docs, helmet CSP and compression.
- React + Vite PWA shell with landing page and the Sataklela OÜ copyleft footer.
- VitePress docs site served at `/docs`, with initial architecture pages and ADRs.
- Dockerfile, `railway.json` and GitHub Actions CI.

- Brand assets in `brand/` (avatar + transparent logo) and `pnpm icons` to generate favicons, PWA/maskable/Apple icons and Open Graph preview images.

- `@qroove/contracts`: zod 4 schemas for rules (with canonical hash), events, requests, player leases, every API body, and typed error codes with user-facing copy.
- `@qroove/scheduler`: pure eligibility, selection, queue projection (ETA and overflow) and quota logic, with example and property tests.
- Docs: scheduler architecture page, ADRs 0004 (no ageing bonus) and 0005 (quota counts played).
- Persistence port (`Repository` / `EventTx`) with a memory adapter and a Firestore adapter, both passing one contract suite; the Firestore run uses the emulator (`pnpm --filter @qroove/server test:emulator`, also in CI).
- Domain commands: create/update/start/pause/resume/end/archive events, end-time and breaks, join, submit/withdraw/remove requests, metadata resolution, admin handover and recovery, player lease (claim, heartbeat, started, finished, release), and snapshot import with a seeded per-style shuffle.
- Automatic next-track reservation, request-state labelling and a denormalised queue preview after every change.
- ESLint rules: `firebase-admin` only under `db/firestore`; no `Date.now()` in domain code.
- Docs: data model page and ADR 0006.
- HTTP API: every route in SPEC §8 plus `by-slug`, `resolve-link`, `admin/session|state|stream|draft|breaks|duplicate|recover|archive`, export/import and the reserved `/api/spotify/callback`; zod-validated bodies and typed JSON errors with a next action.
- Admin auth: URL-fragment secret exchanged for an HttpOnly `SameSite=Strict` cookie, with origin check and double-submit + HMAC CSRF.
- Per-IP/per-participant rate limits and a 16 KB body limit.
- Link intake: allowlisted `parseLink`, Spotify Web API (client credentials, cached token) with oEmbed fallback, iTunes lookup for Apple Music, YouTube oEmbed; SSRF-guarded fetch; ISRC → platform id → fingerprint duplicate keys; possible duplicates held for admin review; style suggestions from title cues only.
- Server-Sent Events (`/stream`, `/admin/stream`) fed by one repository subscription per event.
- Attendee UI: landing with join-by-code, event page (`/e/:slug`) with live connection indicator (SSE with 10 s polling fallback), now playing, "My next song" with a ticking server-clock countdown, add-song form (paste, link preview, manual fallback, style chips, idempotent submit), my songs with confirmed withdraw, up-next list with overflow labelling, privacy page and a dark/light toggle.
- `ANALYZE=1 vite build` writes a bundle report (`rollup-plugin-visualizer`).
- Docs: attendee guide with screenshots.
- Organiser UI: create-event form with templates, one-time organiser link and recovery secret (`/new`), fragment-secret sign-in and handover claim (`/a/:id`, `/claim/:id`), and the organiser page (`/admin/:id`): playback controls with confirmation, moderation with possible-duplicate review, end time extension, breaks, QR + join code, hand-over, player status, read-only rules with fingerprint, typed-confirmation end, carry-over into a new event; read-only past playlist (`/h/:slug`). All lazy-loaded.
- API: `GET /admin/carry-over`; `GET /admin/state` now returns the CSRF token (the page cannot read the API-scoped cookie).
- Docs: organiser guide with screenshots.
- Docs: API reference, realtime, security, threat model and privacy pages.

- First production deploy on Railway (Firestore-backed) at https://qroove.sataklela.com, with Cloudflare DNS; deploy, DNS and Firebase runbooks.

### Changed
- `hashRules`/`canonicalJson` moved to `@qroove/contracts/hash` so the contracts index is browser-safe.
- Licence switched from MIT to AGPL-3.0-only.

- Player (`/player/:eventId`): lease claim/takeover with 10 s heartbeat and immediate stop on `STALE_LEASE`, required sound check, local-file library (files or folder, tags via lazily loaded `music-metadata`, filename fallback), optional IndexedDB "remember on this device", automatic start/finish reporting with auto-advance, manual mode (source link, Mark started/ended), Media Session and Wake Lock.
- `@qroove/contracts/normalise`: `norm`/fingerprint shared by the server and the player.
- Admin state includes each request's `sourceUrl` for manual playback.
- Docs: player guide.
- Retention purge (abandoned drafts 7 d, participants 30 d after end, audit 90 d, idempotency 24 h), run at start-up and every 6 h, and via `POST /api/internal/purge` with `CRON_SECRET`.
- `/import`: start an event from a pasted or uploaded playlist JSON; "Download as JSON" on past events.
- Playwright e2e suite with axe accessibility checks on every route (dark and light), a load-sanity script (`pnpm load`), and CI jobs for the Firestore emulator and e2e.
- Docs: backup and retention runbook.

### Changed
- Firestore transactions on one event are queued in-process, cutting p95 submit latency under 25 concurrent contributors from over 50 s to about 1 s on the emulator.
- Faded (opacity) list rows replaced by a dashed marker, which fixes a colour-contrast failure.
- The server now shuts down cleanly on SIGTERM and releases its Firestore listeners.

