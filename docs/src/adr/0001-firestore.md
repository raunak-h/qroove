# ADR 0001 — Firestore instead of SQLite

**Status:** accepted

## Context

The original spec assumed SQLite. The owner mandated Google Cloud Firestore: it is free at our scale
(Spark tier), needs no volume on the host, and survives redeploys.

## Decision

Use Firestore (Native mode) through `firebase-admin`, server-side only. All persistence sits behind a
`Repository` port with a `memory` adapter for tests and credential-free local development. Firestore
rules deny all client access.

## Consequences

- Domain code never imports `firebase-admin`; only `apps/server/src/db/firestore` does.
- One aggregate document per event gives serialisable transactions.
- Switching database later means writing one adapter.
