# Getting started

## Prerequisites

- Node 24 (`.nvmrc`)
- pnpm 10 (`corepack enable`)

## Run locally

```sh
pnpm install
cp .env.example .env     # defaults to the in-memory repository; no credentials needed
pnpm dev                 # server on :3000, web on :5173 (proxies /api)
```

## Useful commands

| Command          | What it does                    |
| ---------------- | ------------------------------- |
| `pnpm test`      | Unit tests in every workspace   |
| `pnpm typecheck` | `tsc` in every workspace        |
| `pnpm lint`      | ESLint                          |
| `pnpm build`     | Builds web, docs and server     |
| `pnpm docs:dev`  | Live-reloading docs at `/docs/` |

After `pnpm build`, `node apps/server/dist/main.js` serves the app at `/` and these docs at `/docs/`.
