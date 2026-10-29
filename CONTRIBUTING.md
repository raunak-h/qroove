# Contributing to Qroove

Qroove is a CSR initiative of [Sataklela OÜ](https://sataklela.com), licensed AGPL-3.0-only. Contributions are
welcome, especially from dance organisers and DJs who can tell us what actually works at a social.

## Ground rules

- Product rules (fairness, quota, states) are in `plan/SPEC.md`; how the code is built is in
  `plan/EXECUTION_PLAN.md`. Please open an issue before changing a rule: rules are versioned and must not change
  silently.
- Never stream, rip or host audio. Qroove plays files the organiser owns, or runs in manual mode.
- Brand and repository strings live only in `packages/config`.
- `firebase-admin` is imported only under `apps/server/src/db/firestore`; domain and scheduler code never calls
  `Date.now()` (inject a `Clock`).

## Setup

```sh
corepack enable
pnpm install
pnpm dev              # server on :3000, web on :5173
pnpm test             # unit, property and API tests
pnpm lint && pnpm typecheck
pnpm test:e2e         # needs `pnpm build` and `pnpm exec playwright install chromium`
pnpm --filter @qroove/server test:emulator   # needs Java; runs the Firestore emulator
```

## Pull requests

- Keep changes focused, with tests. A change to the scheduler needs example tests and must keep the property
  test passing (`pnpm --filter @qroove/scheduler test:property`).
- Update the docs page it touches and add a line under `## [Unreleased]` in `CHANGELOG.md`.
- Use conventional commits (`feat(web): …`, `fix(server): …`).
- New dependencies: pin an exact version that was published more than 14 days ago.

## Developer Certificate of Origin

Sign off every commit (`git commit -s`) to certify the [DCO](https://developercertificate.org/): that you wrote
the change or have the right to submit it under the project's licence. A `Signed-off-by:` line is required.

## Security

Do not open a public issue for a vulnerability. Contact Sataklela OÜ through the details on
<https://sataklela.com> and see the [threat model](docs/src/threat-model.md).
