# Qroove — agent guide

Fair collaborative music queue PWA for dance socials. A CSR initiative of Sataklela OÜ (AGPL-3.0).

**Every session:** read `plan/PROGRESS.md`, then §0–§5 of `plan/EXECUTION_PLAN.md` and only the section for the
current phase. Product rules live in `plan/SPEC.md` — read only the sections the phase references.

- Stack: pnpm workspaces · TypeScript strict · React+Vite PWA · Fastify · Firestore (behind `Repository` port) · VitePress docs at `/docs` · Railway · Cloudflare DNS.
- MCP servers (`.mcp.json`): `railway`, `firebase`. CLIs `railway`, `firebase` installed globally.
- Commands: `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm docs:dev`.
- Never: hardcode brand/repo strings outside `packages/config`; import `firebase-admin` outside `apps/server/src/db/firestore`; call `Date.now()` in domain/scheduler; stream/rip audio.
- End of phase: tests + build green, docs + CHANGELOG updated, PROGRESS updated, commit (`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`), push.
