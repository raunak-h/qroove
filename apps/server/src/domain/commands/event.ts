import { hashRules } from '@qroove/contracts/hash';
import {
  DomainError,
  breakSlots,
  type CreateEventBody,
  type RulesSnapshot,
} from '@qroove/contracts';
import {
  audit,
  commit,
  loadWork,
  requireAdmin,
  runCommand,
  type CommandOpts,
  type Deps,
} from '../context.js';
import {
  buildBreaks,
  buildRules,
  insertDraft,
  newDraft,
  seedRows,
  type RuleInput,
  type SeedSong,
} from '../draft.js';
import { closePlaying, readPlaying, requireLive } from '../lifecycle.js';
import { breakInProgress } from '../recompute.js';

interface AdminInput extends CommandOpts {
  eventId: string;
  adminSecret: string;
}

export interface CreatedEvent {
  eventId: string;
  slug: string;
  adminSecret: string;
  recoverySecret: string;
  rules: RulesSnapshot;
  joinKey: string;
}

export interface CreateOptions {
  /** Songs to pre-queue (already resolved and capped to the playing time). */
  seeds?: readonly SeedSong[];
  importSeed?: number | null;
}

export async function createEvent(
  deps: Deps,
  body: CreateEventBody,
  opts: CreateOptions = {},
): Promise<CreatedEvent & { seeded: number }> {
  const rules = buildRules(body);
  const planned = body.plannedDurationMin ?? null;
  const breaks = buildBreaks(deps, body.breaks, planned);
  const seeds = opts.seeds ?? [];
  for (const s of seeds) {
    if (!rules.enabledStyles.includes(s.style)) {
      throw new DomainError('VALIDATION', 'Imported songs need one of the event’s styles.');
    }
  }
  const { bundle, secrets } = await insertDraft(deps, () => {
    const d = newDraft(deps, {
      name: body.name,
      timezone: body.timezone,
      rules,
      plannedDurationMin: planned,
      breaks,
      importSeed: opts.importSeed ?? null,
    });
    const rows = seeds.length ? seedRows(deps, d.event, seeds) : {};
    return { event: d.event, adminGrants: d.adminGrants, secrets: d.secrets, ...rows };
  });
  return {
    eventId: bundle.event.id,
    slug: bundle.event.publicSlug,
    rules: bundle.event.rules,
    joinKey: bundle.event.joinKey,
    seeded: seeds.length,
    ...secrets,
  };
}

export interface UpdateDraftInput extends AdminInput, RuleInput {
  name?: string | undefined;
  timezone?: string | undefined;
  plannedDurationMin?: number | null | undefined;
  breaks?: ReadonlyArray<{ label: string; durationSec: number }> | undefined;
}

/** Rules (and everything else) are editable only while the event is a DRAFT. */
export function updateDraft(deps: Deps, input: UpdateDraftInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    if (c.event.state !== 'DRAFT') throw new DomainError('RULES_FROZEN');
    const e = { ...c.event };
    if (input.name !== undefined) e.name = input.name;
    if (input.timezone !== undefined) e.timezone = input.timezone;
    if (input.plannedDurationMin !== undefined) e.plannedDurationMin = input.plannedDurationMin;
    if (input.breaks !== undefined || input.plannedDurationMin !== undefined) {
      e.breaks =
        input.breaks !== undefined
          ? buildBreaks(deps, input.breaks, e.plannedDurationMin)
          : buildBreaks(
              deps,
              e.breaks.map((b) => ({ label: b.label, durationSec: b.durationSec })),
              e.plannedDurationMin,
            );
    }
    e.rules = buildRules(input, c.event.rules);
    audit(c, 'draft.update', 'admin');
    return { ok: true as const, version: c.tx.putEvent(e) };
  });
}

export function startEvent(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    if (c.event.state !== 'DRAFT') {
      if (c.event.state === 'ENDED' || c.event.state === 'ARCHIVED') {
        throw new DomainError('EVENT_ENDED');
      }
      throw new DomainError('VALIDATION', 'This event has already started.');
    }
    const w = await loadWork(c);
    // The planned time starts counting now; breaks are centred on their points of that span.
    const planned = c.event.plannedDurationMin;
    const slots =
      planned === null
        ? []
        : breakSlots(
            planned,
            c.event.breaks.map((b) => b.durationSec / 60),
          );
    w.event = {
      ...c.event,
      state: 'ACTIVE',
      startedAt: c.now,
      endAt: planned === null ? null : c.now + planned * 60_000,
      breaks: c.event.breaks.map((b, i) => ({
        ...b,
        startsAt: slots[i] ? c.now + Math.round(slots[i]!.startMin * 60_000) : null,
      })),
      rulesHash: hashRules(c.event.rules),
    };
    audit(c, 'event.start', 'admin', { rulesHash: w.event.rulesHash });
    return { ok: true as const, version: commit(c, w) };
  });
}

export function pause(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    requireLive(c.event.state);
    if (c.event.state === 'PAUSED') return { ok: true as const, version: c.event.version };
    const w = await loadWork(c);
    w.event = { ...c.event, state: 'PAUSED' };
    audit(c, 'event.pause', 'admin');
    return { ok: true as const, version: commit(c, w) };
  });
}

export function resume(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    const s = c.event.state;
    if (s === 'ACTIVE') return { ok: true as const, version: c.event.version };
    if (s !== 'PAUSED' && s !== 'TRANSFERRING') requireLive(s);
    const w = await loadWork(c);
    w.event = { ...c.event, state: 'ACTIVE', transferOfferId: null };
    audit(c, 'event.resume', 'admin', { from: s });
    return { ok: true as const, version: commit(c, w) };
  });
}

export function setEndTime(deps: Deps, input: AdminInput & { endAt: number }) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    requireLive(c.event.state);
    if (input.endAt <= c.now) {
      throw new DomainError('VALIDATION', 'The end time must be in the future.');
    }
    if (c.event.endAt !== null && input.endAt <= c.event.endAt) {
      throw new DomainError('VALIDATION', 'The new end time must be later than the current one.');
    }
    const w = await loadWork(c);
    w.event = { ...c.event, endAt: input.endAt };
    audit(c, 'event.endTime', 'admin', { from: c.event.endAt, to: input.endAt });
    return { ok: true as const, version: commit(c, w) };
  });
}

export function startBreak(deps: Deps, input: AdminInput & { breakId: string }) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    requireLive(c.event.state);
    const w = await loadWork(c);
    const b = c.event.breaks.find((x) => x.id === input.breakId);
    if (!b) throw new DomainError('NOT_FOUND');
    if (b.actualStart !== null)
      throw new DomainError('VALIDATION', 'This break has already started.');
    if (breakInProgress(w)) throw new DomainError('VALIDATION', 'Another break is in progress.');
    w.event = {
      ...c.event,
      breaks: c.event.breaks.map((x) => (x.id === b.id ? { ...x, actualStart: c.now } : x)),
    };
    audit(c, 'break.start', 'admin', { breakId: b.id });
    return { ok: true as const, version: commit(c, w) };
  });
}

export function endBreak(deps: Deps, input: AdminInput & { breakId: string }) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    requireLive(c.event.state);
    const w = await loadWork(c);
    const b = c.event.breaks.find((x) => x.id === input.breakId);
    if (!b) throw new DomainError('NOT_FOUND');
    if (b.actualStart === null || b.actualEnd !== null) {
      throw new DomainError('VALIDATION', 'This break is not in progress.');
    }
    w.event = {
      ...c.event,
      breaks: c.event.breaks.map((x) => (x.id === b.id ? { ...x, actualEnd: c.now } : x)),
    };
    audit(c, 'break.end', 'admin', { breakId: b.id });
    return { ok: true as const, version: commit(c, w) };
  });
}

/** Skipping a started track counts it as played for spacing, run length and duplicates. */
export function skip(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    requireLive(c.event.state);
    if (!c.event.nowPlaying) throw new DomainError('VALIDATION', 'Nothing is playing.');
    const pb = await readPlaying(c);
    const w = await loadWork(c);
    const skipped = c.event.nowPlaying.requestId;
    closePlaying(c, w, pb, 'SKIPPED', 'SKIPPED');
    audit(c, 'track.skip', 'admin', { requestId: skipped });
    return { ok: true as const, version: commit(c, w) };
  });
}

export interface CarryOverItem {
  title: string;
  artist: string | null;
  style: string;
  durationMs: number | null;
  sourceUrl: string | null;
}

/** ENDED is terminal. Unplayed songs come back to the admin as a carry-over list. */
export function endEvent(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    if (c.event.state === 'ENDED' || c.event.state === 'ARCHIVED') {
      throw new DomainError('EVENT_ENDED');
    }
    const pb = await readPlaying(c);
    const w = await loadWork(c);
    closePlaying(c, w, pb, 'PLAYED', 'PLAYED');
    const unplayed = new Set([
      'PENDING_METADATA',
      'QUEUED',
      'INELIGIBLE_TEMPORARILY',
      'RESERVED_NEXT',
      'OVERFLOW',
    ]);
    const seen = new Set<string>();
    const carryOver: CarryOverItem[] = [];
    for (const r of w.requests.values()) {
      if (!unplayed.has(r.state) || seen.has(r.canonicalKey)) continue;
      seen.add(r.canonicalKey);
      carryOver.push({
        title: r.title,
        artist: r.artist,
        style: r.style,
        durationMs: r.durationMs,
        sourceUrl: r.sourceUrl,
      });
      if (r.state === 'RESERVED_NEXT') w.setState(r, 'QUEUED', c.now);
    }
    w.event = { ...c.event, state: 'ENDED', endedAt: c.now, lease: null, transferOfferId: null };
    audit(c, 'event.end', 'admin', { carryOver: carryOver.length });
    return { ok: true as const, version: commit(c, w), carryOver };
  });
}

export function archive(deps: Deps, input: AdminInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    if (c.event.state !== 'ENDED') {
      throw new DomainError('VALIDATION', 'Only an ended event can be archived.');
    }
    audit(c, 'event.archive', 'admin');
    return { ok: true as const, version: c.tx.putEvent({ ...c.event, state: 'ARCHIVED' }) };
  });
}
