/** Style identifiers are opaque strings here so the scheduler stays dependency-free. */
export type StyleId = string;

export interface Candidate {
  requestId: string;
  ownerId: string;
  style: StyleId;
  acceptedSeq: number;
  canonicalKey: string;
  durationMs: number | null;
  playable: boolean;
}

export interface HistoryState {
  lastStyle: StyleId | null;
  runLength: number;
  lastOwnerId: string | null;
  transitionCount: number;
  ownerLastPlayTransition: Readonly<Record<string, number>>;
  /**
   * Single-genre nights only: after owner p plays, the recordings of other people's songs (oldest
   * first, the first half of those waiting) that must be played before p's next song may start.
   */
  ownerGate: Readonly<Record<string, readonly string[]>>;
  playedKeys: ReadonlySet<string>;
}

/** The subset of the frozen rules snapshot the scheduler needs. */
export interface SchedulerRules {
  enabledStyles: readonly StyleId[];
  runCaps: Readonly<Record<StyleId, number>>;
}

export type Ineligibility =
  | 'SAME_OWNER_ADJACENT'
  | 'NEEDS_STYLE_TRANSITION'
  | 'NEEDS_OTHERS_PLAYED'
  | 'RUN_CAP'
  | 'ALREADY_PLAYED'
  | 'STYLE_DISABLED'
  | 'NOT_PLAYABLE'
  | 'WOULD_EXCEED_END';

export type Eligibility = { ok: true } | { ok: false; reason: Ineligibility };

export interface EligibilityContext {
  /** Playable window left (ms) when a fixed end time is enforced; null/absent = unbounded. */
  remainingMs?: number | null;
  /** Recordings still waiting in the pool; a gated song that left the pool (withdrawn) stops blocking. */
  poolKeys?: ReadonlySet<string>;
}

/** Duration assumed (and flagged uncertain) when a recording's length is unknown. */
export const DEFAULT_DURATION_MS = 4 * 60 * 1000;

/** Run cap used for a style with no configured cap (conservative). */
export const FALLBACK_RUN_CAP = 1;

export const EMPTY_HISTORY: HistoryState = {
  lastStyle: null,
  runLength: 0,
  lastOwnerId: null,
  transitionCount: 0,
  ownerLastPlayTransition: {},
  ownerGate: {},
  playedKeys: new Set(),
};
