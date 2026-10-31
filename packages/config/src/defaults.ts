export const RULE_DEFAULTS = {
  submissionLimit: 20,
  /** The "most songs in a row" master number, used for every genre unless a ratio is set. */
  masterRunCap: 1,
  /** What stored rules may hold; events created before the limit of 3 can still have up to 5. */
  maxRunCap: 5,
  /** The most a new event may choose. */
  maxNewRunCap: 3,
  submissionStep: 5,
  /** Hard limit: no genre may have a smaller share than 1 part in this many of the total ratio. */
  minGenreShareOf: 10,
  transitionOverheadSec: 5,
} as const;

/** Planned time and break limits (SPEC changes from pilot feedback). */
export const EVENT_LIMITS = {
  minDurationMin: 15,
  maxDurationMin: 480,
  /** The time drum moves in quarter hours. */
  durationStepMin: 15,
  defaultDurationMin: 120,
  /** Breaks snap to this grid on the timeline. */
  breakStartStepMin: 10,
  maxBreaks: 3,
  breakStepMin: 10,
  maxBreakMin: 30,
  /** Breaks may take at most this share of the planned time. */
  maxBreakShare: 0.5,
  /** Music that must play between two breaks, or before the first / after the last. */
  minMusicSegmentMin: 20,
} as const;

/** Songs per person: 20 an hour, so 5 for each quarter hour of planned time. */
export const maxSubmissionLimit = (plannedMin: number): number =>
  Math.max(
    RULE_DEFAULTS.submissionStep,
    Math.floor(plannedMin / 15) * RULE_DEFAULTS.submissionStep,
  );
