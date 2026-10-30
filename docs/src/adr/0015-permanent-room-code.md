# ADR 0015 — A permanent room code joins on its own; the QR code is a backup

**Status:** accepted · **Date:** 2026-10-30

## Context

ADR 0008 made the QR code the only way in, but the landing page asks for a typed code first and remote classes have no QR code to scan, so the two screens disagreed.

## Decision

The 6-character room code (the event slug) is permanent and enough to join. It is displayed and typed as two triplets (`ABC-123`), the landing page opens the event as soon as the sixth character is in, and the Invite page shows the code with a QR code underneath that opens the same public link. The secret join key and its error code are removed.

## Consequences

Anyone who learns the code can join and add songs, which is the point for remote classes. Guessing is limited by the 6-character code space (about 10^9) and the join rate limit (20 a minute per IP); organisers can still remove songs, and per-person quotas bound what any one device can add.
