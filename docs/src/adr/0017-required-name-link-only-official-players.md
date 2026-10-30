# ADR 0017 — Required name, link-only adding, official players

**Status:** accepted · **Date:** 2026-10-30

## Context

Pilot feedback: anonymous guests cannot be told apart, the song and playlist forms were separate and asked for details the link already holds, and links could not actually play.

## Decision

- **Name:** joining requires a name (`JoinBody.nickname`). It is free text and not an identity; the per-device token still decides who owns a song.
- **One way to add music:** one field takes a playlist or a song link (`POST /api/resolve-playlist` returns one track for a song). Title, artist and length come from the source. Typed titles are gone from the interface; the API's `manual` body stays for imports and tests.
- **Genre:** the person picks one top-level genre for the link and is told to remove songs of the others. Songs go in under the first style the event allows in that genre, so guests no longer pick a non-Latin variant.
- **Playback order:** a local file first, then the official Spotify or YouTube player in an iframe, then the link with manual mode. Audio never reaches Qroove. This is the optional provider adapter of SPEC §5.
- **A song counts as started only when its player reports playback.** A Spotify 30-second preview (not signed in to Premium) is refused before it counts, and falls back to manual mode.
- **Spotify:** the iframe API script needs `eval`, which the CSP refuses, so the page sends the embed's messages directly (`ready`, `play`, `playback_update`). The protocol is unpublished and may change.
- **CSP and referrer:** `frame-src` allows both providers, `script-src` allows YouTube's API, and the referrer policy is `strict-origin-when-cross-origin` because YouTube's embed needs a referrer. Only the origin is sent cross-origin.

## Consequences

- Many label videos forbid embedding (YouTube errors 101/150); those songs need a local file or manual mode.
- YouTube may show adverts, and its player must stay visible at 200 x 200 px or larger.
- Provider terms and venue public-performance licences still need checking before public use.
