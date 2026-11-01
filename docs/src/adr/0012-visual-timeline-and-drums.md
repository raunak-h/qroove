# ADR 0012 — Timing and numbers are set by a timeline and wheel pickers

**Status:** accepted · **Date:** 2026-10-29

## Context

Typing numbers and entering each break in separate fields was slow and error-prone on a phone.

## Decision

Planned time, songs per person, most songs in a row and every ratio part are wheel pickers (vertical scroll-snap drums that fade away above and below, also operable with arrow keys). Planned time moves in quarter hours (0:15 to 8:00, default 2:00). The evening is one bar that is always the width of its container: tapping adds a 10-minute break snapped to the 10-minute grid; each break has a start and end handle (snapped to 10 minutes, 10 to 30 minutes long) and is removed from the toolbar under the bar. Limits are enforced while dragging (a move that would break them does not happen): at most 3 breaks, at most half of the time, at least 20 minutes of music before, between and after. Genres are colour coded (red salsa, black bachata, orange cha-cha, grey Other; non-Latin styles use the same colour with white stripes) and every colour is drawn with a thin white outline. Swatches replace text labels in queues and pickers, with the name kept for screen readers and tooltips.

## Consequences

Colour is never the only cue: every swatch carries an accessible name, and the non-Latin stripes differ in pattern as well as hue. Playlist links are the only typed field on the create screen, and the name is no longer typed (ADR 0013).

> Colours superseded by [ADR 0021](/adr/0021-ui-overhaul): red salsa, blue bachata, amber cha-cha, purple Other.
