import {
  DEFAULT_ENABLED_STYLES,
  EVENT_LIMITS,
  RULE_DEFAULTS,
  STYLE_PRESETS,
  genreOf as genreOfStyle,
  genresOf,
  type GenreId,
  type StyleId,
} from '@qroove/config';
import {
  songCoverageProblem,
  ratioProblem,
  validateBreaks,
  type BreakSlot,
} from '@qroove/contracts/breaks';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError } from '../shared/api';
import { GenreDot, StyleGrid } from '../shared/Genre';
import { PlaylistInput } from '../shared/PlaylistInput';
import { SongList, type ListSong } from '../shared/SongList';
import { WheelPicker } from '../shared/WheelPicker';
import type { PlaylistSong } from '../shared/api';
import { adminApi, organiserPath } from './adminApi';
import { hm, TimelineBar } from './TimelineBar';
import { ErrorLine } from './useAction';

interface Seg {
  styles: Set<StyleId>;
  master: number;
  /** Per-genre ratio parts; empty means an equal split (every genre gets `master`). */
  ratio: Partial<Record<GenreId, number>>;
}

const newSeg = (): Seg => ({
  styles: new Set(DEFAULT_ENABLED_STYLES),
  master: RULE_DEFAULTS.masterRunCap,
  ratio: {},
});
const copySeg = (s: Seg): Seg => ({
  styles: new Set(s.styles),
  master: s.master,
  ratio: { ...s.ratio },
});
const orderedStyles = (s: Set<StyleId>) =>
  STYLE_PRESETS.filter((p) => s.has(p.id)).map((p) => p.id);

const DURATIONS = Array.from(
  {
    length:
      (EVENT_LIMITS.maxDurationMin - EVENT_LIMITS.minDurationMin) / EVENT_LIMITS.durationStepMin +
      1,
  },
  (_, i) => EVENT_LIMITS.minDurationMin + i * EVENT_LIMITS.durationStepMin,
);
/** The same two-column layout as the style grid: Latin left, non-Latin directly across. */
const PLAYLIST_ROWS: StyleId[][] = [
  ['salsa', 'salsa_nl'],
  ['bachata', 'bachata_nl'],
  ['chacha', 'chacha_nl'],
  ['other'],
];
const DEFAULT_SONG_MS = 4 * 60_000; // a song of unknown length counts as four minutes, like the scheduler

/** Takes one from each list in turn, so a second playlist is not stuck behind the whole first one. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
}

const ONE_TO_FIVE = [1, 2, 3, 4, 5];
const ONE_TO_TWENTY = Array.from({ length: 20 }, (_, i) => i + 1);

/** Drops breaks (and merges their parts) until what is left fits the planned time. */
function fitBreaks(planned: number, breaks: BreakSlot[], segs: Seg[]) {
  let b = breaks;
  let s = segs;
  while (b.length > 0 && validateBreaks(planned, b) !== null) {
    b = b.slice(0, -1);
    s = s.slice(0, -1);
  }
  return { breaks: b, segs: s };
}

export default function CreateEvent() {
  const loc = useLocation();
  const [planned, setPlanned] = useState<number>(EVENT_LIMITS.defaultDurationMin);
  const [breaks, setBreaks] = useState<BreakSlot[]>([]);
  const [segs, setSegs] = useState<Seg[]>([newSeg()]);
  const [sel, setSel] = useState(0);
  const [limit, setLimit] = useState<number>(RULE_DEFAULTS.submissionLimit);
  // Playlists: one link per style; their songs go into one list the organiser can sort.
  const [lists, setLists] = useState<Partial<Record<StyleId, string>>>({});
  const [songs, setSongs] = useState<Array<ListSong & { style: StyleId }>>([]);
  const onTracks = useCallback((key: string, tracks: PlaylistSong[]) => {
    const style = key as StyleId;
    setSongs((prev) => {
      const rest = prev.filter((x) => x.style !== style);
      if (tracks.length === 0) return rest.length === prev.length ? prev : rest;
      return interleave(
        rest,
        tracks.map((t, i) => ({ ...t, style, id: `${style}:${i}:${t.title}` })),
      );
    });
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const go = useNavigate();

  const cur = segs[Math.min(sel, segs.length - 1)]!;
  const curIndex = Math.min(sel, segs.length - 1);
  const patch = (p: Partial<Seg>) =>
    setSegs((all) => all.map((s, i) => (i === curIndex ? { ...s, ...p } : s)));

  const genres = genresOf(orderedStyles(cur.styles));
  const parts = genres.map((g) => cur.ratio[g] ?? cur.master);
  const ratioIssues = segs.map((s) =>
    ratioProblem(genresOf(orderedStyles(s.styles)).map((g) => s.ratio[g] ?? s.master)),
  );
  const empty = segs.some((s) => s.styles.size === 0);
  const everyStyle = STYLE_PRESETS.filter((p) => segs.some((s) => s.styles.has(p.id))).map(
    (p) => p.id,
  );
  // Songs of styles that are no longer in the event are hidden (and dropped when the form is sent).
  const visible = songs.filter((x) => everyStyle.includes(x.style));
  // Only what fits in the planned time minus one minute can be queued; the rest is greyed out.
  const budgetMs = (planned - 1) * 60_000;
  let used = 0;
  let activeCount = 0;
  for (const x of visible) {
    used += x.durationMs ?? DEFAULT_SONG_MS;
    if (used > budgetMs) break;
    activeCount += 1;
  }
  const active = visible.slice(0, activeCount);
  const coverageProblem = songCoverageProblem(
    everyStyle,
    active.map((x) => x.style),
  );
  const covered = new Set(active.map((x) => genreOfStyle(x.style)));
  const playlistsUsed = visible.length > 0;
  const ready = !empty && ratioIssues.every((x) => !x) && !coverageProblem && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const first = segs[0]!;
      // Straight to the organiser page: the entry route signs this browser in and clears the secret.
      const made = await adminApi.create({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        enabledStyles: orderedStyles(first.styles),
        masterRunCap: first.master,
        segments: segs.map((s) => ({
          enabledStyles: orderedStyles(s.styles),
          masterRunCap: s.master,
          ...(Object.keys(s.ratio).length
            ? {
                ratio: Object.fromEntries(
                  genresOf(orderedStyles(s.styles)).map((g) => [g, s.ratio[g] ?? s.master]),
                ),
              }
            : {}),
        })),
        submissionLimit: limit,
        plannedDurationMin: planned,
        ...(breaks.length
          ? {
              breaks: breaks.map((b) => ({
                startMin: b.startMin,
                durationSec: b.durationMin * 60,
              })),
            }
          : {}),
        ...(active.length
          ? {
              songs: active.map(({ title, artist, durationMs, sourceUrl, style }) => ({
                title,
                artist,
                durationMs,
                sourceUrl,
                style,
              })),
            }
          : {}),
      });
      go(organiserPath(made), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={(e) => void submit(e)} noValidate>
      <div className="drum-cell" style={{ margin: '0 auto' }}>
        <WheelPicker
          label="Planned time"
          values={DURATIONS}
          value={planned}
          format={hm}
          onChange={(m) => {
            setPlanned(m);
            const fit = fitBreaks(m, breaks, segs);
            setBreaks(fit.breaks);
            setSegs(fit.segs);
          }}
        />
      </div>

      <TimelineBar
        plannedMin={planned}
        breaks={breaks}
        segments={segs.map((s) => orderedStyles(s.styles))}
        selected={curIndex}
        onSelect={setSel}
        onAdd={(slot) => {
          const at = breaks.filter((b) => b.startMin < slot.startMin).length;
          setBreaks([...breaks, slot].sort((a, b) => a.startMin - b.startMin));
          // The part that was split keeps its choices on both sides.
          setSegs((all) => [
            ...all.slice(0, at),
            copySeg(all[at]!),
            copySeg(all[at]!),
            ...all.slice(at + 1),
          ]);
          setSel(at);
        }}
        onChange={(i, slot) => setBreaks(breaks.map((b, j) => (j === i ? slot : b)))}
        onRemove={(i) => {
          setBreaks(breaks.filter((_, j) => j !== i));
          setSegs((all) => [...all.slice(0, i + 1), ...all.slice(i + 2)]);
          setSel(Math.max(0, Math.min(sel, i)));
        }}
      />

      <StyleGrid value={cur.styles} onChange={(styles) => patch({ styles })} />
      {cur.styles.size === 0 ? (
        <p className="error" role="alert">
          Pick at least one style.
        </p>
      ) : null}

      <div className="drums">
        <div className="drum-cell">
          <WheelPicker
            label="Most songs in a row"
            values={ONE_TO_FIVE}
            value={cur.master}
            onChange={(master) => patch({ master, ratio: {} })}
            className="small"
          />
          <span className="muted small">in a row</span>
        </div>
        <div className="drum-cell">
          <WheelPicker
            label="Accepted songs per person"
            values={ONE_TO_TWENTY}
            value={limit}
            onChange={setLimit}
            className="small"
          />
          <span className="muted small">songs each</span>
        </div>
      </div>

      {genres.length > 1 ? (
        <details>
          <summary aria-label="Ratio between genres">
            <span aria-hidden="true">{parts.join(' : ')}</span>
          </summary>
          <div className="drums">
            {genres.map((g) => (
              <div key={g} className="drum-cell">
                <WheelPicker
                  label={`Ratio ${g}`}
                  values={ONE_TO_FIVE}
                  value={cur.ratio[g] ?? cur.master}
                  onChange={(n) =>
                    patch({
                      ratio: {
                        ...Object.fromEntries(genres.map((x) => [x, cur.ratio[x] ?? cur.master])),
                        [g]: n,
                      },
                    })
                  }
                  className="small"
                />
                <GenreDot genre={g} />
              </div>
            ))}
          </div>
          {ratioIssues[curIndex] ? (
            <p className="error" role="alert">
              {ratioIssues[curIndex]}
            </p>
          ) : null}
        </details>
      ) : null}
      {ratioIssues.some((x, i) => x && i !== curIndex) ? (
        <p className="error" role="alert">
          {ratioIssues.find((x, i) => x && i !== curIndex)}
        </p>
      ) : null}

      <details id="playlist" open={loc.hash === '#playlist' || undefined}>
        <summary aria-label="Start from playlists">
          <span aria-hidden="true">♫ +</span>
        </summary>
        <div className="playlist-grid">
          {PLAYLIST_ROWS.flat().map((id) =>
            everyStyle.includes(id) ? (
              <PlaylistInput
                key={id}
                style={id}
                label={`Playlist link for ${STYLE_PRESETS.find((p) => p.id === id)!.label}`}
                value={lists[id] ?? ''}
                onChange={(v) => setLists({ ...lists, [id]: v })}
                id={id}
                onTracks={onTracks}
                missing={playlistsUsed && !covered.has(genreOfStyle(id))}
              />
            ) : (
              <span key={id} aria-hidden="true" />
            ),
          )}
        </div>
        {visible.length > 0 ? (
          <>
            <SongList
              songs={visible}
              onChange={(next) =>
                setSongs([
                  ...(next as Array<ListSong & { style: StyleId }>),
                  ...songs.filter((x) => !everyStyle.includes(x.style)),
                ])
              }
              activeCount={activeCount}
              label="Playlist songs"
            />
            <p className="muted small playlist-budget" aria-live="polite">
              {Math.round(Math.min(used, budgetMs + 1) / 60000)} / {planned - 1} min
            </p>
          </>
        ) : null}
        {coverageProblem && visible.length > 0 ? (
          <p className="error" role="alert">
            {coverageProblem}
          </p>
        ) : null}
      </details>

      <ErrorLine error={error} />
      <button type="submit" className="btn primary" disabled={!ready}>
        {busy ? '…' : 'Create event'}
      </button>
    </form>
  );
}
