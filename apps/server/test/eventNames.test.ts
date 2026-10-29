import { describe, expect, it } from 'vitest';
import { NAME_WORDS, NAME_WORD_LIST } from '@qroove/config';
import { EMPTY_NAME_LEDGER, type NameLedger } from '../src/db/types.js';
import { formatName, nameCount, pickName } from '../src/domain/eventNames.js';
import { mulberry32 } from '../src/domain/ids.js';
import { testApp } from './api-helpers.js';

describe('word list', () => {
  it('is large, unique, single lower-case words from the four neutral groups', () => {
    expect(NAME_WORD_LIST.length).toBeGreaterThanOrEqual(100);
    expect(new Set(NAME_WORD_LIST).size).toBe(NAME_WORD_LIST.length);
    for (const w of NAME_WORD_LIST) expect(w).toMatch(/^[a-z]+$/);
    expect(Object.keys(NAME_WORDS)).toEqual(['fruit', 'vegetable', 'carb', 'sea']);
    expect(nameCount(NAME_WORD_LIST)).toBeGreaterThan(1_000_000);
  });
});

describe('pickName', () => {
  const small = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // 7 x 6 x 5 = 210 names
  const run = (count: number, seed = 1, words: readonly string[] = small) => {
    const rand = mulberry32(seed);
    let ledger: NameLedger = structuredClone(EMPTY_NAME_LEDGER);
    const out: string[][] = [];
    for (let i = 0; i < count; i++) {
      const r = pickName(ledger, rand, words);
      ledger = r.ledger;
      out.push(r.words);
    }
    return { out, ledger };
  };

  it('uses three distinct words and capitalises them', () => {
    const { out } = run(50);
    for (const w of out) expect(new Set(w).size).toBe(3);
    expect(formatName(['mango', 'octopus', 'rye'])).toBe('Mango Octopus Rye');
  });

  it('never repeats a name until every ordered permutation has been used', () => {
    const { out, ledger } = run(210);
    const keys = out.map((w) => w.join('|'));
    expect(new Set(keys).size).toBe(210); // all 210 distinct: nothing repeated early
    expect(ledger.cycle).toBe(0);
    // The 211th name starts a new cycle, and only then may a name come back.
    const rand = mulberry32(99);
    const next = pickName(ledger, rand, small);
    expect(next.ledger.cycle).toBe(1);
    expect(next.ledger.used).toHaveLength(1);
  });

  it('shares no word with the previous name, except possibly at the very end of a cycle', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { out } = run(150, seed);
      for (let i = 1; i < 150; i++) {
        const prev = new Set(out[i - 1]);
        expect(
          out[i]!.some((w) => prev.has(w)),
          `seed ${seed} step ${i}`,
        ).toBe(false);
      }
    }
  });

  it('with the real dictionary, consecutive names never share a word over a long run', () => {
    const { out } = run(3000, 7, NAME_WORD_LIST);
    const keys = new Set(out.map((w) => w.join('|')));
    expect(keys.size).toBe(3000);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.some((w) => out[i - 1]!.includes(w))).toBe(false);
    }
  });

  it('keeps going when only overlapping names are left, rather than stalling or repeating', () => {
    const { out } = run(210, 3);
    expect(new Set(out.map((w) => w.join('|'))).size).toBe(210);
  });
});

describe('POST /api/events', () => {
  it('names the event itself, and refuses a name sent by the client', async () => {
    const { api } = await testApp();
    const sent = await api.call('POST', '/api/events', {
      body: { name: 'Something rude', timezone: 'UTC' },
    });
    expect(sent.status).toBe(400);
    const a = await api.call('POST', '/api/events', { body: { timezone: 'UTC' } });
    const b = await api.call('POST', '/api/events', { body: { timezone: 'UTC' } });
    expect(a.status).toBe(201);
    const nameOf = async (r: typeof a) => {
      const slug = r.json.slug as string;
      return (await api.call('GET', `/api/events/by-slug/${slug}`)).json.name as string;
    };
    const [na, nb] = [await nameOf(a), await nameOf(b)];
    expect(na).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(na).not.toBe(nb);
    const wa = na.toLowerCase().split(' ');
    expect(
      nb
        .toLowerCase()
        .split(' ')
        .some((w) => wa.includes(w)),
    ).toBe(false);
  });
});
