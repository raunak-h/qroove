import {
  DEFAULT_ENABLED_STYLES,
  EVENT_LIMITS,
  RULE_DEFAULTS,
  STYLE_PRESETS,
  genresOf,
  type GenreId,
} from '@qroove/config';
import { z } from 'zod';
import { ratioProblem } from './breaks.js';

const STYLE_IDS = STYLE_PRESETS.map((s) => s.id) as [
  (typeof STYLE_PRESETS)[number]['id'],
  ...(typeof STYLE_PRESETS)[number]['id'][],
];
export const StyleId = z.enum(STYLE_IDS);
export type StyleId = z.infer<typeof StyleId>;

const RunCap = z.number().int().min(1).max(RULE_DEFAULTS.maxRunCap);

/**
 * One stretch of the evening. Breaks split the night into segments, and each segment has its own
 * styles and caps. `runCaps` is keyed by genre (see `genreOf`): a genre's cap is the "most songs in
 * a row" number, equal to `masterRunCap` unless a ratio was chosen.
 */
export const Segment = z
  .object({
    enabledStyles: z.array(StyleId).min(1).max(STYLE_IDS.length),
    masterRunCap: RunCap,
    runCaps: z.partialRecord(StyleId, RunCap),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.enabledStyles).size !== r.enabledStyles.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'enabledStyles must be unique',
        path: ['enabledStyles'],
      });
    }
    const genres = genresOf(r.enabledStyles);
    for (const g of genres) {
      if (r.runCaps[g] === undefined) {
        ctx.addIssue({ code: 'custom', message: `missing run cap for ${g}`, path: ['runCaps', g] });
      }
    }
    for (const k of Object.keys(r.runCaps)) {
      if (!genres.includes(k as GenreId)) {
        ctx.addIssue({
          code: 'custom',
          message: `run cap for unused genre ${k}`,
          path: ['runCaps', k],
        });
      }
    }
    const problem = ratioProblem(genres.map((g) => r.runCaps[g] ?? 1));
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['runCaps'] });
  });
export type Segment = z.infer<typeof Segment>;

/** SPEC §3.1 — frozen at event start. One segment per stretch between breaks. */
export const RulesSnapshot = z.object({
  rulesVersion: z.literal(3),
  segments: z
    .array(Segment)
    .min(1)
    .max(EVENT_LIMITS.maxBreaks + 1),
  submissionLimit: z.number().int().min(1).max(20),
  /** Retired (ADR 0018); only events created before then still carry these. */
  minStyleTransitions: z.literal(1).optional(),
  noSameRequesterAdjacent: z.literal(true).optional(),
  recordingUniquePerEvent: z.literal(true),
  admissionOrder: z.literal('fifo'),
});
export type RulesSnapshot = z.infer<typeof RulesSnapshot>;

/** Every style that is allowed somewhere in the evening. */
export function allowedStyles(rules: RulesSnapshot): StyleId[] {
  return STYLE_IDS.filter((id) => rules.segments.some((s) => s.enabledStyles.includes(id)));
}

/** A segment where every genre gets `master` unless `ratio` (per genre) says otherwise. */
export function defaultSegment(
  enabled: readonly StyleId[] = DEFAULT_ENABLED_STYLES,
  master: number = RULE_DEFAULTS.masterRunCap,
  ratio: Partial<Record<GenreId, number>> = {},
): Segment {
  const runCaps: Record<string, number> = {};
  for (const g of genresOf(enabled)) runCaps[g] = ratio[g] ?? master;
  return { enabledStyles: [...enabled], masterRunCap: master, runCaps };
}

/** Rules for a new event; `segmentCount` identical segments unless `segments` is given. */
export function defaultRules(
  enabled: readonly StyleId[] = DEFAULT_ENABLED_STYLES,
  master: number = RULE_DEFAULTS.masterRunCap,
  ratio: Partial<Record<GenreId, number>> = {},
  segmentCount = 1,
): RulesSnapshot {
  return {
    rulesVersion: 3,
    segments: Array.from({ length: segmentCount }, () => defaultSegment(enabled, master, ratio)),
    submissionLimit: RULE_DEFAULTS.submissionLimit,
    recordingUniquePerEvent: true,
    admissionOrder: 'fifo',
  };
}
