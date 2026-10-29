# Qroove — Progress Tracker

Update at the end of every phase (see `plan/EXECUTION_PLAN.md` §5).

**Current phase:** 0
**Next session starts with:** Phase 0 step 1 — ask the user to run `! firebase login --no-localhost` and `! railway login --browserless`, then continue Phase 0. If the user is unavailable, skip to Phase 1 (Phases 1–8 don't need Phase 0).

## Phases
- [ ] 0 — Accounts, MCP & infra provisioning (MCP config + CLIs done during planning)
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
- firebase login, railway login (Phase 0)
- Service-account key → `.secrets/firebase-sa.json` and Railway var (Phase 0)
- Spotify developer app credentials (Phase 0, non-blocking)
- Cloudflare DNS records (Phase 9)

## Notes per phase
