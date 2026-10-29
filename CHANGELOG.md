# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
