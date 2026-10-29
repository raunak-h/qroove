# Qroove — Progress Tracker

Update at the end of every phase (see `plan/EXECUTION_PLAN.md` §5).

**Current phase:** 2
**Next session starts with:** Phase 2 (contracts + scheduler). Phases 0–1 done.

## Phases

- [x] 0 — Accounts, MCP & infra provisioning
- [x] 1 — Monorepo scaffold, branding, docs skeleton, CI
- [ ] 2 — Contracts + scheduler
- [ ] 3 — Persistence ports, adapters, domain commands
- [ ] 4 — HTTP API, auth, realtime, metadata
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
- PWA icons are SVG-only (`purpose: any`/`maskable`); PNG 192/512 not generated.
