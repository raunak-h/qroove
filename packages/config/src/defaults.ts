import type { StyleId } from './styles.js';

export const RULE_DEFAULTS = {
  submissionLimit: 5,
  runCaps: { salsa: 2, bachata: 2 } as Partial<Record<StyleId, number>>,
  otherStyleRunCap: 1,
  minStyleTransitionsSinceRequesterPlay: 1,
  transitionOverheadSec: 5,
} as const;
