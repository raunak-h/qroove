# ADR 0005 — Quota counts played and skipped-after-start songs

**Status:** accepted · **Date:** 2026-10-29

## Context

SPEC §3.3 offers two readings of "five songs": five accepted over the whole event, or five waiting at once.

## Decision

Use the conservative reading in SPEC §3.3: five accepted songs per participant per event. `PENDING_METADATA`, `QUEUED`,
`INELIGIBLE_TEMPORARILY`, `RESERVED_NEXT`, `OVERFLOW`, `PLAYING`, `PLAYED` and `SKIPPED` count. `WITHDRAWN`,
`REJECTED` and `UNAVAILABLE` do not, so removing an unstarted song frees its slot. A song that fails or is skipped after
it started still counts, to avoid a loophole.

## Consequences

Matches the stated aim (no one dominates). To be validated with dancers in the first pilot; "five waiting at once"
would be a different, versioned rule.
