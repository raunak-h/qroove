# Qroove — Progress Tracker

Update at the end of every phase (see `plan/EXECUTION_PLAN.md` §5).

**Current phase:** 5
**Next session starts with:** Phase 5 (Attendee UI). Phases 0–4 done.

## Phases

- [x] 0 — Accounts, MCP & infra provisioning
- [x] 1 — Monorepo scaffold, branding, docs skeleton, CI
- [x] 2 — Contracts + scheduler
- [x] 3 — Persistence ports, adapters, domain commands
- [x] 4 — HTTP API, auth, realtime, metadata
- [ ] 5 — Attendee UI
- [ ] 6 — Admin UI
- [ ] 7 — Player
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
