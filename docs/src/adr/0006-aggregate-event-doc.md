# ADR 0006 — One aggregate document per event

**Status:** accepted · **Date:** 2026-10-29

## Context

Quota, duplicate blocking, reservation and stale-controller fencing all need serialisable read-modify-write
across several records, on a store with no joins and per-document contention limits.

## Decision

Keep the shared mutable state (version, counters, history, reservation, lease, preview) in a single `events/{id}`
document. Every command runs in a transaction that reads it first and bumps `version`. Per-record data
(participants, requests, recording keys) lives in subcollections and is read in the same transaction.

Recording keys, idempotency keys and admin grants are keyed by a SHA-256 of the secret or client-supplied key,
so lookups are direct and no raw secret is stored or placed in a document path.

## Consequences

- One event handles roughly one write per second, ample for about 40 users.
- Correctness does not depend on in-process locks, so a second instance would still be safe.
- Every write to the event document wakes subscribers; heartbeats write with `silent` to avoid that.
- Unused composite indexes were avoided: request lists are filtered in Firestore and sorted in the adapter.
