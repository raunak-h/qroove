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

### Changed
- `hashRules`/`canonicalJson` moved to `@qroove/contracts/hash` so the contracts index is browser-safe.
- Licence switched from MIT to AGPL-3.0-only.
