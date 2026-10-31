# ADR 0020 — Spotify search for guests, optional playlists, new limits

**Status:** accepted · **Date:** 2026-10-31

## Context

Live-test feedback: guests want to find music inside Qroove, and organisers want gentler defaults that suit the event's length. Spotify's Development Mode allows 5 authorised accounts.

## Decision

- Search uses the app's own credentials (`GET /api/spotify/search`), so no guest needs an account. Spotify limits it to 10 results per request.
- Guests on the account list may log in, with playlist-reading scopes only. Their playlists are fetched by the server (`/api/spotify/me/playlists`), and guest pages never hold a Spotify token. Spotify only returns songs for playlists the person owns or collaborates on.
- Songs in a row default to 1 and new events may choose up to 3. Stored rules still accept 5, so older events remain readable.
- Songs per person default to 20, in steps of 5 in the interface, up to 5 per 15 planned minutes (`maxSubmissionLimit`), enforced by the server.
- Pause means "pause at the end of the current song". Skip takes two confirmations.

## Consequences

- At 1:1 with a strict genre limit, the queue waits whenever only the genre that just played has songs left.
- This is not a Spotify Jam: Qroove's queue and rules decide what plays.
