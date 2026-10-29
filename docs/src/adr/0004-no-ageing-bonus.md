# ADR 0004 — No ageing bonus in the MVP

**Status:** accepted · **Date:** 2026-10-29

## Context

SPEC §3.7 suggests exposing an ageing bonus to prevent style starvation, but never allowing it to override hard
constraints, and says comparators must not change mid-event.

## Decision

The MVP selects the style with the oldest eligible request, tie-breaking away from the last style. There is no ageing
bonus. Oldest-first already prevents starvation: a waiting request only gets older relative to newer arrivals, and hard
constraints (adjacency, transitions, caps) are the only things that can hold it back.

## Consequences

The comparator is simple to explain and to test. If pilots show a style being starved in practice, a bonus can be
introduced as a new versioned rule (`rulesVersion` 2) without altering events already running.
