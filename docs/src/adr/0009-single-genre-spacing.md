# ADR 0009 — Spacing when only one genre is enabled

**Status:** accepted · **Date:** 2026-10-29

## Context

With one genre there is never a style change, so "wait for a style change" would block every returning requester forever.

## Decision

When exactly one genre is enabled, after a requester's song starts, the songs other people have waiting at that moment are snapshotted oldest first. That requester's next song is held until the first half (rounded up) of them have played. Songs that were withdrawn or removed stop counting. If nobody else is waiting there is no hold; the rule against the same person twice in a row still applies.

## Consequences

The hold is deterministic and visible as "Waiting for other people's songs to play first". Property tests check that returning requesters always wait for that half.
