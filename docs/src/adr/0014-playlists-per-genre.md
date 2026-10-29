# ADR 0014 — Playlist import needs a playlist for every genre

**Status:** accepted · **Date:** 2026-10-29

## Context

One playlist cannot sensibly fill a night with several genres.

## Decision

Playlists are given per style (at most one each). If any is given, every genre active in any part of the evening must be covered by at least one: a Latin style's playlist covers its non-Latin counterpart and the other way round. Songs from all playlists are interleaved, one from each in turn, then cut to the planned time minus one minute, so no genre is crowded out by a long playlist. Each song takes the style of the playlist it came from.

## Consequences

Playlist pages are public web pages, not an API, so import is best effort. Time is shared in turns, not proportionally to the ratio.
