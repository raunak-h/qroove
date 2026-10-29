# Scheduler

`packages/scheduler` is a pure, dependency-free TypeScript package. It never reads the clock and never mutates its
inputs: the same input always produces the same output. The server feeds it the frozen rules, the committed
history and the waiting candidates; it answers "who is eligible", "what plays next" and "what will the queue look like".

## Rules

A request `t` of style `g` owned by participant `p` is **eligible** iff all of these hold (checked in this order, so the
reported reason is deterministic):

| Check               | Reason code              | Meaning                                                              |
| ------------------- | ------------------------ | -------------------------------------------------------------------- |
| playable media      | `NOT_PLAYABLE`           | A playable source is available where required.                       |
| style enabled       | `STYLE_DISABLED`         | `g` is among the event's allowed styles.                             |
| unique recording    | `ALREADY_PLAYED`         | The canonical recording has not been started in this event.          |
| no adjacency        | `SAME_OWNER_ADJACENT`    | `p` is not the owner of the last started song.                       |
| style transition    | `NEEDS_STYLE_TRANSITION` | At least one style change since `p`'s last started song (if any).    |
| run cap             | `RUN_CAP`                | If `g` is the last style, the current run is strictly below its cap. |
| fits before the end | `WOULD_EXCEED_END`       | Only when a concrete end time is set: the song must finish in time.  |

Unknown run caps fall back to 1. A song with unknown duration is assumed to last 4 minutes and flagged **uncertain**.

## History

`HistoryState` is `{ lastStyle, runLength, lastOwnerId, transitionCount, ownerLastPlayTransition, playedKeys }`.
`applyPlay` records a started song: a different style from `lastStyle` increments `transitionCount` once and resets
`runLength` to 1; the owner's `ownerLastPlayTransition` becomes the new `transitionCount`. An owner may return once
`transitionCount > ownerLastPlayTransition[owner]`. A song skipped after it started counts as played. Pauses and
breaks never touch history.

## Selection comparator

`selectNext` implements SPEC §3.7:

1. Keep only eligible candidates, grouped by style (a style at its run cap is already excluded).
2. For each style take its oldest eligible request (`acceptedSeq`, then `requestId`).
3. Pick the style whose oldest request is oldest overall. Ties prefer a style other than the last, then style id.
4. Play that request.

It returns the pick, a human-readable `reason` (for example `Oldest eligible Bachata; Salsa at run cap 2/2`) and the
list of blocked requests with their reasons. With no pick, the reason is `NO_CANDIDATES` or
`ALL_BLOCKED_FAIRNESS: …` (for example "Waiting for another contributor or a style change").

## Projection

`projectQueue` repeatedly runs `selectNext` + `applyPlay` on a copy of the history, advancing a simulated clock by each
song's duration plus transition overhead, starting after the current song's remaining time. Breaks are windows: a song must end at or before the next break starts, and when nothing fits the clock resumes at the
break's end. With a concrete end time a song that cannot finish inside the music windows is reported as **overflow** (listed, greyed
out, never claimed unreachable — withdrawals, shorter songs or an extension can change that). Requests that are blocked
only by fairness are **waiting**, not overflow. The result carries `stoppedReason`: `EXHAUSTED`, `WAITING_FAIRNESS` or
`HORIZON` (default horizon: 50 songs). With no end time nothing is ever overflow.

## Worked example

A owns all the Salsa songs and B all the Bachata songs (cap 2 each):

| Step | Pick | Why                                                             |
| ---- | ---- | --------------------------------------------------------------- |
| 1    | A-S1 | Oldest eligible.                                                |
| 2    | B-B1 | A-S2 is blocked (same owner adjacent); B-B1 is oldest eligible. |
| 3    | A-S2 | A has seen a style transition since S1.                         |
| 4    | B-B2 | Same logic for B.                                               |

`A-S1, A-S2, B-B1, B-B2` is never produced, even though it respects the 2:2 style cap. If only one person owns every
remaining song, one plays and the queue shows "Waiting for another contributor or a style change".

## Invariants (property-tested)

For random queues (1–8 owners, 1–4 styles, caps 1–3, up to 60 requests, optional end time) the projection never:
plays the same owner twice in a row; lets an owner return without an intervening style transition; exceeds a run cap;
repeats a canonical recording; starts or ends a non-overflow song after the end time. It is also deterministic.
`pnpm test` runs 2,000 cases; `pnpm --filter @qroove/scheduler test:property` runs 100,000.

See [ADR 0004](/adr/0004-no-ageing-bonus) and [ADR 0005](/adr/0005-quota-counts-played).

## Genres and single-genre spacing

The scheduler's `style` is the **genre** (the server maps each request's style with `genreOf`). With exactly one genre
enabled, `NEEDS_STYLE_TRANSITION` is replaced by `NEEDS_OTHERS_PLAYED`; see [ADR 0009](/adr/0009-single-genre-spacing).

## Parts of the evening

Rules are held per part (segment) of the evening, split by the breaks ([ADR 0011](/adr/0011-per-segment-rules)).
`projectQueue` takes `ruleWindows` (the rules from a given time on) next to the single `rules`, and uses the window
in force when a song would start. A candidate carries its genre as `style` (for runs and changes) and its exact style
as `variant`; `allowedVariants` lets a part allow salsa but not non-Latin salsa. A song blocked only by `STYLE_DISABLED`
or by not fitting before a break makes the clock jump to the end of that break.
