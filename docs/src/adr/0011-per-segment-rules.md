# ADR 0011 — Rules per part of the evening

**Status:** accepted · **Date:** 2026-10-29

## Context

Breaks split the night into parts, and organisers want different genres (and ratios) in each part.

## Decision

The rules snapshot (version 3) holds one segment per stretch between breaks: its allowed styles, its "most songs in a row" number and its per-genre ratio, with the same checks as before (at least one style, caps for every active genre, no genre below 1 part in 10). New parts start as copies of the part they were split from. The scheduler receives rule windows and uses the rules in force at the time a song would start. A song whose style is not allowed in the current part waits for a part that allows it (it is not marked as running past the end). A request is accepted if any part allows its style. Single-genre spacing (ADR 0009) applies per part. History (last genre, run length, waiting holds) carries across parts.

## Consequences

Rules v1 and v2 events cannot be read; none existed outside throw-away drafts. The "Other (Musicality Exercise)" style is its own genre with no non-Latin counterpart.
