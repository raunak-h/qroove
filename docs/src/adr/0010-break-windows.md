# ADR 0010 — Breaks centred on the planned time, songs never run into them

**Status:** accepted · **Date:** 2026-10-29

## Context

Pilot feedback: breaks must sit at the midpoint of the plan, be shown in the queue, and never be able to take over the night.

## Decision

The organiser sets a planned time (10 minutes to 8 hours, steps of 10) which starts counting when the event starts. Breaks (10, 20 or 30 minutes, at most 3) are spread evenly and centred: one break sits on the midpoint, so 10 minutes in a 2-hour event run 55 to 65. Hard limits, checked on creation: together at most half the planned time, at least 20 minutes of music before the first, between breaks and after the last (so breaks can never be back to back), set before the event starts. The scheduler treats each break as a window: a song is eligible only if it ends at or before the break starts; if nothing fits, the projection resumes at the break's end. The organiser starts and ends the break (the page prompts when it is due); a break never started is dropped once its slot has fully passed.

## Consequences

There is no automatic break timer; between the last song that fits and the organiser pressing Start break the room is quiet, which is flagged on the organiser screen.
