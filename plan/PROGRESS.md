# Qroove — Progress Tracker

Update at the end of every phase (see `plan/EXECUTION_PLAN.md` §5).

**Current phase:** 8
**Next session starts with:** Phase 8 (Hardening, e2e, a11y, perf). Phases 0–7 done.

## Phases

- [x] 0 — Accounts, MCP & infra provisioning
- [x] 1 — Monorepo scaffold, branding, docs skeleton, CI
- [x] 2 — Contracts + scheduler
- [x] 3 — Persistence ports, adapters, domain commands
- [x] 4 — HTTP API, auth, realtime, metadata
- [x] 5 — Attendee UI
- [x] 6 — Admin UI
- [x] 7 — Player
- [ ] 8 — Hardening, e2e, a11y, perf
- [ ] 9 — Deploy (Railway + Cloudflare + Firestore)
- [ ] 10 — Release 0.1.0 + transfer readiness

## Decisions made (during planning, 2026-10-29)

- Firestore (new Firebase project, Spark tier) replaces SQLite from SPEC §7.
- Docs: VitePress served by the app at `/docs`.
- Metadata: Spotify Web API (keys supplied by user) + keyless oEmbed/iTunes fallbacks.
- Domain: `qroove.sataklela.com` via Cloudflare. Branded as a Sataklela OÜ CSR initiative.
- Licence AGPL-3.0 (copyleft). Repo may move to a company org → brand/repo URL centralised in `packages/config`.

## Blocked / needs user

- None.

## Notes per phase

### Phase 0 (2026-10-29)

- Firebase project `qroove-sataklela` (Spark), Firestore `(default)` in `eur3`, rules deny-all + indexes deployed.
- Firestore TTL needs billing → idempotency cleanup moved to purge job.
- Service account `qroove-server@qroove-sataklela.iam.gserviceaccount.com` (roles/datastore.user); key at `.secrets/firebase-sa.json` (gitignored).
- Railway: workspace "Raunak's Projects", project `qroove` (0b641c46-8212-47d0-855e-2c9d5c0c64bb), env `production` (98c294ea-68d2-496e-8ad9-bca1cccf1c68), service `web` (64552298-e13d-4699-b3df-913c5b4ca77a), repo linked locally via `railway link`. Variables set (no deploy yet): NODE_ENV, PUBLIC_BASE_URL, REPO_DRIVER=firestore, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_B64, COOKIE_SECRET, CRON_SECRET, SPOTIFY_CLIENT_ID.
- Spotify redirect URI registered: `https://qroove.sataklela.com/api/spotify/callback` → reserve `/api/spotify/*`.
- Cloudflare MCP authenticated (Phase 9 DNS).

### Phase 1 (2026-10-29)

- Monorepo scaffolded: pnpm 10.34.9 (via corepack), TS 5.9 strict, ESLint 9, Prettier, Vitest 4. Local default pnpm was v12; `packageManager` pins 10.
- Server bundled with tsup (`noExternal: @qroove/*`) because workspace packages are source-only `.ts`. Docker image builds and serves `/api/health`, `/docs/`, `/` (verified).
- Versions chosen as newest >14 days old: `@vitejs/plugin-react` 5.2.0 (6.x needs Vite 8; plan says Vite 7); TypeScript 5.9.3 (7.x skipped, new native port).
- VitePress config imports `packages/config/src/brand` by relative path (VitePress config loader can't resolve the workspace `.ts` package). Docs theme adds the shared footer via `layout-bottom`.
- CSP: `/docs` gets `script-src 'self' 'unsafe-inline'` (VitePress inline bootstrap scripts); everything else stays `'self'`. Covered by a test.
- Mermaid is a plain fenced block for now (no plugin); revisit if diagrams need rendering.
- Brand art added post-phase: `brand/` holds logo + avatar; `pnpm icons` generates PNG icons, maskable, Apple touch, OG images (replaces the placeholder SVG icons).

### Phase 2 (2026-10-29)

- `packages/scheduler` is dependency-free: `StyleId` is an opaque string there; contracts' `RulesSnapshot` has a partial `runCaps`, so Phase 3 must adapt it to `SchedulerRules` (fill missing caps / use `FALLBACK_RUN_CAP`).
- Scheduler `HistoryState.playedKeys` is a `Set`; the Firestore `EventDoc` stores an array — convert at the adapter boundary.
- Overflow is decided by an eligibility check (`WOULD_EXCEED_END`, `remainingMs`), so a shorter later song may still fit; overflow items are appended after playable ones with `predictedStartMs: null`.
- `OVERFLOW` is included in quota-counting states (SPEC §3.3); the plan's list omitted it.
- Property test: 2,000 runs in `pnpm test`; `pnpm --filter @qroove/scheduler test:property` = 100,000 runs (passes).
- `z.partialRecord` is required for non-exhaustive enum-keyed records in zod 4.

### Phase 3 (2026-10-29)

- `apps/server/src/db/{ports,types}.ts`, `memory/`, `firestore/`; `createRepository(env)` lazy-loads Firestore. Domain commands in `src/domain/commands/`, shared plumbing in `context.ts` (`runCommand`, `Work`, `commit`) and `recompute.ts`.
- Tests: `test/repo.contract.ts` and `test/commands.suite.ts` run against memory (`pnpm test`) and the Firestore emulator (`pnpm --filter @qroove/server test:emulator`; needs Java; wired into CI). 39 tests each, all passing, including the 6-concurrent-submit, concurrent-duplicate, stale-admin and stale-epoch cases.
- Plan deviations: times stored as plain epoch-ms numbers (no Timestamp converters); `RequestDoc.ownerId` replaces `participantId` (indexes file updated; request lists are sorted in the adapter, so the composite indexes are not actually used); `putEvent(doc, {silent})` for heartbeats; added `EventDoc.{playbackSeq,leaseEpoch,transferOfferId,importSeed}`; `putPlayback`/`getPlayback` instead of `appendPlayback`. `subscribe` passes the raw event doc; the LRU public-view cache is deferred to Phase 4, where the view is built.
- Decisions: claiming the player requires an admin secret (a separate player credential can come later); a lease claim or handover treats any track still playing as consumed; handover claim leaves the event PAUSED so the receiver must resume; only one handover offer is live at a time and resuming cancels it; a recovery secret can replace all admin access (`recoverAdmin`); `startBreak` holds new starts until `endBreak`; submissions are accepted while PAUSED but not reserved until resume; a duplicate is refused before quota is checked.
- Phase 4 must: build `RequestView`/`EventPublicView` from `getEventPublic`, add `parseLink`/`canonicalKey` and call `resolveMetadata` for `PENDING_METADATA`, set `Idempotency-Key` through `idempotencyKey`, and skip SSE pushes for silent (heartbeat) writes.
- Not covered: a player-side "media unavailable before start" command (reserved track that cannot play); the admin can remove it.

### Phase 4 (2026-10-29)

- `apps/server/src/{api,ingestion,security,realtime}`; `buildApp(env, {repo, clock, fetch})` takes overrides for tests. 64 new tests (API via `inject`, SSE over a real port, ingestion with a mocked network). Emulator suite still 39/39.
- Plan deviations: no `fastify-type-provider-zod` (zod 4 compatibility risk) — a small `parse(schema, data)` helper does the same; no `@fastify/rate-limit` or `@fastify/cookie` — an in-process sliding-window limiter and a tiny cookie parser (prod runs one instance, so per-process limits are exact); SSE pushes the full public view on each change instead of a ≤4 KB revision message (queue capped at 50); `EventPublicView` kept from Phase 2 and gained `runIndicator`.
- Auth transport: participant `Authorization: Bearer <participantId>:<token>`; admin cookie `qa_<id>` holds the raw secret (HttpOnly), CSRF = HMAC(`COOKIE_SECRET`, secret) echoed in header and `qc_<id>` cookie. Without `COOKIE_SECRET` a random per-process key is used (sessions' CSRF tokens then reset on restart; prod sets it).
- Duplicates: `RequestDoc` gained `keys`, `looseKey`, `possibleDuplicate`. Certain duplicate = any of ISRC / platform id / exact fingerprint already locked (fingerprint hits where both durations are known and differ >5 s are treated as uncertain). Uncertain (loose-key hit, i.e. same artist+title with another version tag) = request held as `PENDING_METADATA` + `possibleDuplicate`, never reserved until an admin approves or rejects (`admin/duplicate/:rid`). A held request never takes over another request's key locks; withdraw/reserve/start only touch locks it owns.
- Spotify oEmbed has no artist, so a Spotify link without API keys has no artist and its fingerprint only matches manual entries with an empty artist. With keys (ISRC, artist) matching is much better — set `SPOTIFY_CLIENT_SECRET` in Railway before the pilot.
- Added routes beyond the plan list: `admin/draft` (PATCH), `admin/archive`, `admin/recover`, `admin/duplicate/:rid`, export/import.
- Not done / for later: purge job and retention (Phase 8); `statusText` copy and `RATE_LIMITED` retry-after hints are plain; SSE client reconnect + polling fallback is Phase 5; Firestore read cost per change grows with request count (fine at pilot size).

### Phase 5 (2026-10-29)

- `apps/web/src/{attendee,shared,landing}`; web imports only **types** from `@qroove/contracts` (error copy comes from the API's own `error.message/action`, so zod is not bundled). `hashRules` moved to `@qroove/contracts/hash` (needs `node:crypto`).
- Tests: 15 new (countdown/pluralisation/duration parsing, `nextSong` states, EventPage flows with a stubbed fetch). Screenshots in `docs/src/public/screens/` were taken with Playwright (chromium + system libs installed in the codespace; the scripts are not committed — Phase 8 adds the real e2e setup).
- **Bundle size:** attendee route initial load is ~79 KB gzip JS (react-dom ≈ 45, react-router ≈ 20, app ≈ 15) + 1.8 KB CSS, so the 40 KB target is **not met**. Only the placeholder `/create` route is code-split so far; Phase 6/7 must lazy-load admin and player. Cheapest future saving: replace react-router with a ~1 KB router (≈ −20 KB). Re-measure with `ANALYZE=1 pnpm exec vite build`.
- Decisions: joining is an explicit one-tap card (so a nickname can be set) instead of an automatic join; "songs until" counts the playing song plus songs ahead in the preview; `/create` is a placeholder until Phase 6; the queue never shows nicknames' owners beyond what the API sends — the UI ignores `ownerNickname` entirely.
- Not done: QR code for the join link (admin screen, Phase 6); service-worker offline shell is whatever vite-plugin-pwa generates (no runtime caching of API).

### Phase 6 (2026-10-29)

- `apps/web/src/admin/*`, `shared/widgets.tsx` (ConfirmButton, CopyButton, QrCode). QR uses `qrcode-generator` 2.0.4 (tiny, no deps) rendered as one SVG path, instead of `qrcode`. 10 new web tests; server +1 (carry-over/CSRF).
- Routes: `/new` (plan said `/new`; landing links there), `/a/:id#k=`, `/claim/:id#c=` (shared `AdminEntry`), `/admin/:id`, `/h/:slug`. Handover code lives in the fragment; both entries replace the history entry before navigating so secrets leave the address bar.
- CSRF: the CSRF cookie is scoped to `/api/events/<id>`, so page JS cannot read it; `GET /admin/state` returns the token and commands send it as `X-Qroove-CSRF`. The token is not in the SSE stream.
- Decisions: confirmation is an inline two-step button (no modal dialogs); templates set name/end time only ("Dance break N min" ends N min after pressing it, so start soon after); Skip needs confirmation but Pause does not; "Transfer player" is a status panel + link to `/player/:id` — the player itself is Phase 7, and a takeover claim already fences the old device; the created panel shows the recovery secret inside a `<details>`.
- Bug caught by tests: number inputs that clamped on every keystroke turned "4" into "14"; they now keep raw text and clamp on submit.
- Bundle: attendee initial JS ≈ 80 KB gz (+0.6 KB vs Phase 5); AdminPage 4.6 KB, CreateEvent 10.4 KB (includes the shared widgets + QR), others <1 KB, all lazy.
- Not done: editing a DRAFT after creation from the UI (the `PATCH admin/draft` API exists; the form is create-only); admin page does not show participants' counts; pre-start seed removal for imported events is possible via Remove once started, not in DRAFT view since DRAFT has no moderation-specific tools beyond Remove.

### Phase 7 (2026-10-29)

- `apps/web/src/player/*` (lazy route `/player/:eventId`, 5.4 KB gz + `music-metadata` 12.2.1 as a separate on-demand chunk; attendee initial JS unchanged at ≈ 80 KB gz). `norm`/fingerprint moved to `@qroove/contracts/normalise` (server `domain/keys.ts` re-exports). `AdminRequestView.sourceUrl` added. 9 new web tests (matching, lease/start/finish flow, manual mode, stale lease).
- Player uses the admin state stream (needs the admin cookie and CSRF for `claim` only); the reserved song is the request in `RESERVED_NEXT`. Lease creds live in memory + `sessionStorage` (reload resumes via heartbeat).
- Decisions: Start is blocked until lease held + sound check done; auto-advance only after one successful user-initiated `play()`; a refused autoplay drops back to the Start button; audio load error before start → manual mode, after start → `FAILED` (counts as skipped); release/takeover leaves any playing track to the server's claim rule (closed as played); exact match = same fingerprint, title-only match is allowed when either artist is missing and is labelled "probable"; the per-request file choice is local only (no availability reported to the server).
- Not done: availability per request sent to the server (SPEC §5 "mapping availability"; MVP shows it locally only); `pagehide` release (reload must keep the lease); real-browser audio is untested in CI (jsdom stubs) — Phase 8 e2e should cover it with a generated WAV and Chromium's fake audio; the server has no "media unavailable before start" command.
