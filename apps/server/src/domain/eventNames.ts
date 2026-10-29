import { NAME_WORD_LIST } from '@qroove/config';
import type { NameLedger } from '../db/types.js';
import type { Deps } from './context.js';
import { mulberry32 } from './ids.js';

/**
 * Event names are generated, never typed, so nobody can enter a rude or misleading one. A name is
 * an ordered triple of distinct neutral words. Rules:
 *  - a name is not handed out again until every possible ordered triple has been used (then the
 *    ledger starts a new cycle);
 *  - the next name shares no word with the previous one. If the only unused names left all share
 *    a word with it (possible only in the last few names of a cycle) the rule yields, because
 *    exhausting every permutation takes priority.
 */
const code = (n: number, i: number, j: number, k: number) => (i * n + j) * n + k;
const decode = (n: number, c: number): [number, number, number] => [
  Math.floor(c / (n * n)),
  Math.floor(c / n) % n,
  c % n,
];

export const nameCount = (words: readonly string[]) => {
  const n = words.length;
  return n * (n - 1) * (n - 2);
};

export const formatName = (ws: readonly string[]) =>
  ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Pure: picks the next name and returns the updated ledger. */
export function pickName(
  ledger: NameLedger,
  rand: () => number,
  words: readonly string[] = NAME_WORD_LIST,
): { ledger: NameLedger; words: [string, string, string] } {
  const n = words.length;
  if (n < 6) throw new Error('Need at least six words to avoid repeats between names');
  const total = nameCount(words);
  let used = new Set(ledger.used);
  let cycle = ledger.cycle;
  if (used.size >= total) {
    used = new Set();
    cycle += 1;
  }
  const last = new Set(ledger.last ?? []);
  const free = (c: number, avoidLast: boolean) => {
    if (used.has(c)) return false;
    if (!avoidLast) return true;
    const [i, j, k] = decode(n, c);
    return !(last.has(words[i]!) || last.has(words[j]!) || last.has(words[k]!));
  };
  const sample = (): number => {
    const i = Math.floor(rand() * n);
    let j = Math.floor(rand() * (n - 1));
    if (j >= i) j += 1;
    let k = Math.floor(rand() * (n - 2));
    for (const taken of [Math.min(i, j), Math.max(i, j)]) if (k >= taken) k += 1;
    return code(n, i, j, k);
  };

  let chosen = -1;
  // Uniform rejection sampling: fast while most names are still unused.
  for (let tries = 0; tries < 200 && chosen < 0; tries++) {
    const c = sample();
    if (free(c, true)) chosen = c;
  }
  // Near the end of a cycle, walk the whole space from a random start instead.
  for (const avoidLast of [true, false]) {
    if (chosen >= 0) break;
    const start = Math.floor(rand() * n * n * n);
    for (let step = 0; step < n * n * n && chosen < 0; step++) {
      const c = (start + step) % (n * n * n);
      const [i, j, k] = decode(n, c);
      if (i === j || j === k || i === k) continue;
      if (free(c, avoidLast)) chosen = c;
    }
  }
  const [i, j, k] = decode(n, chosen);
  const picked: [string, string, string] = [words[i]!, words[j]!, words[k]!];
  used.add(chosen);
  return { ledger: { used: [...used], last: picked, cycle }, words: picked };
}

/** Claims the next event name from the shared ledger (atomic across instances). */
export function claimEventName(deps: Deps): Promise<string> {
  const rand = mulberry32(deps.ids.seed());
  return deps.repo.updateNameLedger((ledger) => {
    const { ledger: next, words } = pickName(ledger, rand);
    return { ledger: next, result: formatName(words) };
  });
}
