# ADR 0007 — Genre groups, one master number and a ratio floor

**Status:** accepted · **Date:** 2026-10-29

## Context

Pilot feedback: organisers need non-Latin songs that fit a Latin style, and one simple "most songs in a row" setting. A ratio between genres must never starve a genre.

## Decision

Six styles (salsa, bachata, cha-cha and a non-Latin compatible variant of each) belong to three genres. Style changes, run lengths and caps are counted per **genre**: salsa followed by non-Latin salsa-compatible is not a change. One master number (1 to 5, default 2) is the cap for every genre. An optional ratio sets a per-genre cap (parts 1 to 5, for example 1:5 or 1:1:5). Hard limit: no genre may have less than 1 part in 10 of the ratio, so 1:5:5 is refused while 1:5 and 1:1:5 are allowed. Rules snapshot version 2; caps are keyed by genre.

## Consequences

The scheduler is unchanged apart from receiving the genre as its style. Kizomba, merengue and "other" are gone. Old rules snapshots (version 1) are not readable; no event of that version existed outside throw-away drafts.
