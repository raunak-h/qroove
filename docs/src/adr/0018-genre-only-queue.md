# ADR 0018 — The queue looks at genres, not at who added a song

**Status:** accepted · **Date:** 2026-10-30 · Supersedes the requester-spacing rule of SPEC §1 and §3, and ADR 0009

## Context

In the first live test, a queue with two people stalled after four songs because of the requester-spacing rules, and one person could not keep the music going however many genres they added.

## Decision

Eligibility no longer considers the owner: the "no adjacent songs from one person", "a genre change since your last song" and single-genre "half of the others first" rules are removed. What remains: each genre's run cap, no repeated recording, the event's allowed styles, the end time, and oldest-first selection. An event with one genre has no run cap. The per-person song limit stays.

The change applies to events already running. Their stored rule snapshots keep the old fields, which are now ignored.

## Consequences

- One person's songs can play back to back, so nothing stops the earliest guest from taking the first several slots of the night. The per-person limit is the only fairness control left.
- If only one genre has songs waiting and it is at its cap, the queue still waits for another genre.
