# Data model

Persistence sits behind the `Repository` port (`apps/server/src/db/ports.ts`). Two adapters implement it and
pass the same contract suite: `memory/` (tests, local dev without credentials) and `firestore/` (production).
Domain code never imports `firebase-admin`; ESLint enforces that.

## Collections

```
slugs/{slug}                       { eventId }
events/{eventId}                   EventDoc            ← aggregate root
  participants/{participantId}     { tokenHash, nickname, joinedAt, lastSeenAt, acceptedCount }
  requests/{requestId}             RequestDoc
  recordingKeys/{sha256(key)}      { key, requestId, state: active | consumed | released }
  playback/{seq}                   { requestId, ownerId, style, startedAt, endedAt, outcome }
  adminGrants/{sha256(secret)}     { role: admin | recovery, issuedAt, revokedAt }
  handoverOffers/{sha256(code)}    { expiresAt, usedAt }
  audit/{autoId}                   { action, actorRole, at, payload, idempotencyKey }
  idempotency/{sha256(key)}        { response, at }
```

All times are epoch milliseconds stored as plain numbers. Secrets (participant tokens, admin and recovery
secrets, lease tokens, handover codes) are stored only as SHA-256 hashes. Firestore security rules deny every
client; only the server, using a service account, reads or writes.

## The event document

`EventDoc` is the transactional aggregate root. Every command runs in one transaction that reads it first and
writes it back with `version + 1`. It holds the frozen `rules` and `rulesHash`, the mutable schedule (`endAt`,
`breaks`), scheduler `history`, the single `reservation`, `nowPlaying`, the player `lease`, and a denormalised
`preview` so reads are cheap. Concurrency is therefore decided by Firestore (or the memory adapter's per-event
queue), not by application locks.

| Field                | Meaning                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `acceptedSeq`        | Monotonic intake counter; FIFO order within a style.                                      |
| `leaseEpoch`         | Fencing counter. Never reset, even when a lease is released.                              |
| `reservation`        | The one next track. Set iff exactly one request is `RESERVED_NEXT`.                       |
| `nowPlaying`         | Set when the player reports that audio actually started.                                  |
| `history.playedKeys` | Canonical recording keys that have started. Stored as an array; a `Set` in the scheduler. |
| `transferOfferId`    | The one outstanding handover offer while `TRANSFERRING`.                                  |
| `importSeed`         | Shuffle seed when the event was created from a snapshot.                                  |

## Transactions

`EventTx` follows Firestore's rule that all reads precede all writes. Writes are buffered and flushed when the
callback resolves; a read after a write throws in both adapters, so a violation is caught by the in-memory tests
rather than first appearing in production. `putEvent` always bumps `version`, except heartbeats, which pass
`silent` so a player ping does not wake every client.

## Commands

Each command in `apps/server/src/domain/commands/` runs in one transaction, checks state, permission and rules,
and writes an audit record (never a secret). Commands that mint secrets (`joinEvent`, `claimLease`,
`createHandoverOffer`, `claimHandover`) do not accept an idempotency key because the stored response would
contain the secret.

After any mutation, `recompute` keeps the single reservation, re-labels requests (`QUEUED`,
`INELIGIBLE_TEMPORARILY`, `OVERFLOW`) from the scheduler's projection, and rewrites `preview` and
`waitingReason`. A track is reserved only while nothing is playing, because the history used for fairness
checks changes when a song starts.

## Rules enforced here

- **Quota** (five per participant): recounted from the participant's requests inside the transaction, so the
  stored counter cannot drift. Six concurrent submits accept exactly five.
- **Duplicates**: the recording key is read in the same transaction. A duplicate is refused before quota is
  checked, so it costs nothing. Keys are `released` when a song is withdrawn or removed, and `consumed` once it
  starts, which keeps a played recording blocked.
- **Frozen rules**: only `updateDraft` can change rules, and only in `DRAFT`.
- **Stale controllers**: an admin secret is revoked server-side at handover; a player must present the current
  `leaseToken` and `epoch`.
