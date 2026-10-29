import {
  DEFAULT_ENABLED_STYLES,
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
 * SPEC §3.1 — frozen at event start. `runCaps` is keyed by genre (see `genreOf`): a genre's cap is
 * the "most songs in a row" number, equal to `masterRunCap` unless a ratio was chosen.
 */
export const RulesSnapshot = z
  .object({
    rulesVersion: z.literal(2),
    enabledStyles: z.array(StyleId).min(1).max(STYLE_IDS.length),
    masterRunCap: RunCap,
    runCaps: z.partialRecord(StyleId, RunCap),
    submissionLimit: z.number().int().min(1).max(20),
    minStyleTransitions: z.literal(1),
    noSameRequesterAdjacent: z.literal(true),
    recordingUniquePerEvent: z.literal(true),
    admissionOrder: z.literal('fifo'),
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
export type RulesSnapshot = z.infer<typeof RulesSnapshot>;

/** Rules for a new event: every genre gets `master` unless `ratio` (per genre) says otherwise. */
export function defaultRules(
  enabled: readonly StyleId[] = DEFAULT_ENABLED_STYLES,
  master: number = RULE_DEFAULTS.masterRunCap,
  ratio: Partial<Record<GenreId, number>> = {},
): RulesSnapshot {
  const runCaps: Record<string, number> = {};
  for (const g of genresOf(enabled)) runCaps[g] = ratio[g] ?? master;
  return {
    rulesVersion: 2,
    enabledStyles: [...enabled],
    masterRunCap: master,
    runCaps,
    submissionLimit: RULE_DEFAULTS.submissionLimit,
    minStyleTransitions: 1,
    noSameRequesterAdjacent: true,
    recordingUniquePerEvent: true,
    admissionOrder: 'fifo',
  };
}
