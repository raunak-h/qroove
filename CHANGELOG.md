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

### Changed
- Licence switched from MIT to AGPL-3.0-only.
