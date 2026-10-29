import { createHash } from 'node:crypto';
import { RULE_DEFAULTS, STYLE_PRESETS, DEFAULT_ENABLED_STYLES } from '@qroove/config';
import { z } from 'zod';

const STYLE_IDS = STYLE_PRESETS.map((s) => s.id) as [
  (typeof STYLE_PRESETS)[number]['id'],
  ...(typeof STYLE_PRESETS)[number]['id'][],
];
export const StyleId = z.enum(STYLE_IDS);
export type StyleId = z.infer<typeof StyleId>;

const RunCap = z.number().int().min(1).max(10);

/** SPEC §3.1 — frozen at event start. */
export const RulesSnapshot = z
  .object({
    rulesVersion: z.literal(1),
    enabledStyles: z.array(StyleId).min(2).max(STYLE_IDS.length),
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
    for (const s of r.enabledStyles) {
      if (r.runCaps[s] === undefined) {
        ctx.addIssue({ code: 'custom', message: `missing run cap for ${s}`, path: ['runCaps', s] });
      }
    }
  });
export type RulesSnapshot = z.infer<typeof RulesSnapshot>;

/** Rules for a new event; unspecified optional styles get the conservative default cap. */
export function defaultRules(enabled: readonly StyleId[] = DEFAULT_ENABLED_STYLES): RulesSnapshot {
  const runCaps: Record<string, number> = {};
  for (const s of enabled) runCaps[s] = RULE_DEFAULTS.runCaps[s] ?? RULE_DEFAULTS.otherStyleRunCap;
  return {
    rulesVersion: 1,
    enabledStyles: [...enabled],
    runCaps,
    submissionLimit: RULE_DEFAULTS.submissionLimit,
    minStyleTransitions: 1,
    noSameRequesterAdjacent: true,
    recordingUniquePerEvent: true,
    admissionOrder: 'fifo',
  };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function canonicalJson(v: unknown): string {
  return canonical(v);
}

/** sha256 of the key-sorted JSON; `enabledStyles` is sorted so order does not change the hash. */
export function hashRules(rules: RulesSnapshot): string {
  const normalised = { ...rules, enabledStyles: [...rules.enabledStyles].sort() };
  return createHash('sha256').update(canonical(normalised)).digest('hex');
}
