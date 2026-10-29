# Threat model

STRIDE-style view of the risks listed in the product spec. "Where" points at the code that enforces the control.

| Threat                                  | Category        | Control                                                                                             | Where                          |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| Racing duplicate requests               | Tampering       | Recording keys read and written in the event transaction; losers get `DUPLICATE` and spend no quota | `domain/commands/requests.ts`  |
| Quota races (6th song accepted)         | Tampering       | Quota recounted inside the transaction                                                              | same                           |
| Same song via another platform          | Tampering       | ISRC → platform id → fingerprint keys all lock; lookalikes with other versions go to admin review   | `ingestion/`, `domain/keys.ts` |
| Stale playback device                   | Spoofing        | Lease token + monotonic epoch on every player call; takeover bumps the epoch                        | `domain/commands/player.ts`    |
| Forged "track ended"                    | Spoofing        | Needs the current lease token and epoch and must name the playing request                           | same                           |
| Event takeover / stale admin            | Elevation       | Server-side grant revocation at handover; admin secret hashed; recovery secret separate             | `domain/commands/handover.ts`  |
| Admin CSRF                              | Tampering       | SameSite=Strict cookie, origin check, double-submit + HMAC CSRF token                               | `security/tokens.ts`           |
| Token leakage via referrer/screenshot   | Info disclosure | Admin secret only in URL fragment; never in query strings; `no-store` on secret responses           | `api/routes.ts`                |
| Malicious catalogue URLs / SSRF         | Elevation       | Host allowlist, id extraction, fixed outbound hosts, no redirects, size and time caps               | `ingestion/`                   |
| Join-link amplification / abuse         | DoS             | Per-IP and per-participant limits; 16 KB body cap                                                   | `security/rateLimit.ts`        |
| Same user, multiple identities          | Spoofing        | Not prevented (no login by design); mitigated by IP limits and admin moderation                     | accepted risk                  |
| Browser clock manipulation              | Tampering       | All scheduling uses the server clock; clients only tick locally from `serverNow`                    | `domain/clock.ts`              |
| Leaking owners or tokens in public view | Info disclosure | Public view contains request ids and optional display nicknames only                                | `api/views.ts` (tested)        |
| Erasing play history                    | Repudiation     | Played requests cannot be removed; every command writes a redacted audit record                     | `domain/commands/requests.ts`  |
| Public access to audio                  | Info disclosure | The server never stores or serves audio; the player uses local files                                | architecture                   |
| Direct database access                  | Elevation       | Firestore rules deny all clients; only the service account reads or writes                          | `firestore.rules`              |
