# ADR 0021 — Live deck and planner overhaul

**Status:** accepted · **Date:** 2026-11-01

## Context

Two reference designs (a participant live deck and an organiser planner) set a new visual direction: charcoal cards, an amber accent, one colour per genre, and a clearer hierarchy on both screens.

## Decision

- The designs are translated into the existing React components, routes, API calls and realtime stream. No iframes, no template scripts, no new dependencies on CDNs; the templates' demo-only parts (the _Switchover_ button, canned Spotify results, fake success toasts) are not shipped. Advancing the track stays an organiser action.
- **Colours:** one map in `packages/config` (`GENRE_COLOURS`): red salsa, blue bachata, amber cha-cha, purple Other. Non-Latin styles are the same colour with white stripes, and every swatch carries a text label.
- **Planner preview:** the progression bar calls `projectQueue` from `@qroove/scheduler` with plenty of synthetic songs per enabled style, per-part rules and breaks, so it shows what the queue will do. The songs are assumed to arrive in blocks of each genre's "songs in a row" size, which shows the fullest rotation; the live queue plays at most that many in a row. The song count is an explicitly approximate range (one song every 3.5 to 5 minutes of music).
- **Synced parameters:** while on, changing the total duration sets songs per person to `round(minutes / 15) × 5`, kept between 5 and 50 and never above `maxSubmissionLimit`. Switching it on again does not rewrite a manual choice. The wheel itself still offers every step the server accepts.
- **Genres:** the parent switch and the non-Latin switch each map to one style, so switching a parent off does not rewrite its variant.
- **Deck:** Next up is the first non-overflow song of the shared queue; times come only from the scheduler's own prediction and only when it is not marked uncertain (in My songs, an uncertain one is marked rough). Played and skipped songs go under a disclosure; removed or not-found songs stay in the active list because they need attention.

## Consequences

- `@qroove/scheduler` is now also a dependency of the web app (loaded only with the planner chunk).
- The server's `toSchedulerRules` is mirrored in `apps/web/src/admin/progression.ts`; if one changes, change the other.
