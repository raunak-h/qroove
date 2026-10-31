# ADR 0019 — Spotify's Web Playback SDK on the organiser's device

**Status:** accepted · **Date:** 2026-10-31

## Context

The embedded player needs a Spotify session in a third-party cookie, which browsers increasingly block, and speaks an unpublished protocol.

## Decision

The organiser logs in with Spotify (authorization code flow, server-side secret), and the page becomes a Spotify device through the Web Playback SDK. The refresh token is kept only in an encrypted, HttpOnly cookie on that device. The page receives short-lived access tokens, because the SDK and the play call need them, so those tokens are readable by page scripts. The embedded player remains the fallback.

## Consequences

- Spotify's Development Mode allows 5 accounts, each added by hand, and the app owner needs Premium. Wider use needs Extended Quota or an agreement with Spotify.
- Spotify's terms limit commercial and public use; written approval and venue licences must be checked before a public launch.
- Phones have the strictest autoplay rules. `activateElement` runs in the first tap, but following on to the next song on a phone is unproven.
