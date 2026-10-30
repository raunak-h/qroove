# ADR 0016 — Playlists are sorted by the person before they are added

**Status:** accepted · **Date:** 2026-10-30

## Context

A mixed playlist rarely fits a quota, and people want to choose which songs come first.

## Decision

Guests and organisers use the same interface: paste a public playlist link, the songs load into a list (`POST /api/resolve-playlist`), and the person drags to reorder, swipes left to remove (red bin) or swipes right to send a song to the top (green arrow, not offered on the first row). Songs beyond the allowance (a guest's remaining quota, or what fits the planned time minus one minute for an organiser) are greyed out and can be promoted. Guests send the sorted top songs in one request (`POST /requests/batch`), added in order until the quota is full, with one style for the batch; organisers send the sorted songs with the create request, which replaces server-side playlist fetching. The server still checks every limit, keeps only supported source links, and requires every active genre to have a song.

## Consequences

One style per guest batch means a mixed-genre playlist is best added in several batches. Loading a playlist relies on public web pages, so it can fail or show only the first part of a long list.
