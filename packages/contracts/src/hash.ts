import { createHash } from 'node:crypto';
import type { RulesSnapshot } from './rules.js';

// Server-only: kept out of the package index so browser bundles never see `node:crypto`.
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
