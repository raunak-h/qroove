# ADR 0013 — Event names are generated, never typed

**Status:** accepted · **Date:** 2026-10-29

## Context

A free-text event name can show offensive or misleading text to everyone who joins.

## Decision

The server names every event with three distinct neutral words (fruit, vegetables, carbs, sea creatures; 112 words, about 1.4 million ordered triples), for example "Mango Octopus Rye". A shared ledger (one Firestore document) records the triples handed out in the current cycle and the previous name. A name is not handed out again until every ordered triple has been used (then a new cycle starts). The next name shares no word with the previous one; only in the last few names of a cycle, when every unused triple overlaps, does that rule yield so that all permutations can still be exhausted. Clients cannot send a name: the create request rejects unknown fields. Carried-over events get a new generated name too.

## Consequences

The ledger holds every used triple, which is small at this scale (about 8 bytes each in a document that holds roughly 100,000). Attendee nicknames are still free text.
