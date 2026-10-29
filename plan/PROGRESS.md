# Qroove — Progress Tracker

Update at the end of every phase (see `plan/EXECUTION_PLAN.md` §5).

**Current phase:** 1
**Next session starts with:** Phase 1 (scaffold). Phase 0 done.

## Phases
- [x] 0 — Accounts, MCP & infra provisioning
- [ ] 1 — Monorepo scaffold, branding, docs skeleton, CI
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
