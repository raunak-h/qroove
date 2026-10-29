import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConnectionBadge } from '../attendee/ConnectionBadge';
import { playerApi, type LeaseCreds } from '../admin/adminApi';
import { useAdminStream } from '../admin/useAdminStream';
import { ErrorLine } from '../admin/useAction';
import { ApiError } from '../shared/api';
import { useLockedPage } from '../shared/useLockedPage';
import { formatCountdown } from '../shared/time';
import {
  findMatch,
  isAudio,
  trackFromFile,
  withTags,
  type LocalTrack,
  type Match,
} from './library';
import { clearTracks, loadTracks, saveTracks } from './store';
import { playTone } from './tone';

type LeaseState = 'none' | 'held' | 'busy' | 'lost';

const HEARTBEAT_MS = 10_000;
const leaseKey = (id: string) => `qroove:lease:${id}`;

function readLease(id: string): LeaseCreds | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(leaseKey(id)) ?? 'null') as LeaseCreds | null;
    return v && typeof v.leaseToken === 'string' && typeof v.epoch === 'number' ? v : null;
  } catch {
    return null;
  }
}

function writeLease(id: string, l: LeaseCreds | null) {
  try {
    if (l) sessionStorage.setItem(leaseKey(id), JSON.stringify(l));
    else sessionStorage.removeItem(leaseKey(id));
  } catch {
    /* memory only */
  }
}

export default function PlayerPage() {
  const { eventId = '' } = useParams();
  useLockedPage();
  const stream = useAdminStream(eventId);
  const { state: s, csrf } = stream;

  const [leaseState, setLeaseState] = useState<LeaseState>('none');
  const lease = useRef<LeaseCreds | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [library, setLibrary] = useState<LocalTrack[]>([]);
  const [remember, setRemember] = useState(false);
  const [picked, setPicked] = useState<Record<string, LocalTrack>>({});
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [soundChecked, setSoundChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  /** Mirrors of refs that the screen needs to show. */
  const [audioId, setAudioId] = useState<string | null>(null);
  const [myEpoch, setMyEpoch] = useState<number | null>(null);

  const audio = useRef<HTMLAudioElement>(null);
  /** Request the audio element is currently loaded with, and whether the server has been told. */
  const current = useRef<{ id: string; reported: boolean; url: string } | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);

  const reserved = s?.requests.find((r) => r.state === 'RESERVED_NEXT') ?? null;
  const nowPlaying = s?.view.nowPlaying ?? null;
  const reservedDuration =
    s?.view.queue.find((q) => q.requestId === reserved?.id)?.durationMs ?? null;

  const match: Match | null = useMemo(() => {
    if (!reserved) return null;
    const p = picked[reserved.id];
    if (p) return { track: p, kind: 'exact' };
    if (failed.has(reserved.id)) return null;
    return findMatch(library, reserved);
  }, [reserved, library, picked, failed]);

  // ---- lease -------------------------------------------------------------------------------
  const stopAudio = useCallback(() => {
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    if (current.current) URL.revokeObjectURL(current.current.url);
    current.current = null;
    setAudioId(null);
    void wake.current?.release().catch(() => undefined);
    wake.current = null;
  }, []);

  const lose = useCallback(() => {
    stopAudio();
    lease.current = null;
    writeLease(eventId, null);
    setMyEpoch(null);
    setLeaseState('lost');
  }, [eventId, stopAudio]);

  const guard = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.code === 'STALE_LEASE') lose();
      else setError(e instanceof ApiError ? e : null);
    },
    [lose],
  );

  async function claim(takeover: boolean) {
    if (!csrf) return;
    setError(null);
    try {
      const r = await playerApi.claim(eventId, csrf, takeover);
      lease.current = { leaseToken: r.leaseToken, epoch: r.lease.epoch };
      writeLease(eventId, lease.current);
      setMyEpoch(r.lease.epoch);
      setLeaseState('held');
      setNotice(null);
      stream.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STALE_LEASE') setLeaseState('busy');
      else setError(e instanceof ApiError ? e : null);
    }
  }

  async function release() {
    const l = lease.current;
    stopAudio();
    lease.current = null;
    writeLease(eventId, null);
    setMyEpoch(null);
    setLeaseState('none');
    setUnlocked(false);
    if (l) await playerApi.release(eventId, l).catch(() => undefined);
    stream.refresh();
  }

  // Resume after a reload with the lease kept in sessionStorage.
  useEffect(() => {
    const l = readLease(eventId);
    if (!l) return;
    playerApi
      .heartbeat(eventId, l)
      .then(() => {
        lease.current = l;
        setMyEpoch(l.epoch);
        setLeaseState('held');
      })
      .catch(() => writeLease(eventId, null));
  }, [eventId]);

  useEffect(() => {
    if (leaseState !== 'held') return;
    const id = setInterval(() => {
      const l = lease.current;
      if (l) playerApi.heartbeat(eventId, l).catch(guard);
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [leaseState, eventId, guard]);

  // Another device claimed the lease: stop immediately, without waiting for our next heartbeat.
  const epoch = s?.lease?.epoch;
  useEffect(() => {
    if (
      leaseState === 'held' &&
      lease.current &&
      epoch !== undefined &&
      epoch !== lease.current.epoch
    ) {
      lose();
    }
  }, [epoch, leaseState, lose]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // ---- library -----------------------------------------------------------------------------
  useEffect(() => {
    loadTracks()
      .then((t) => {
        if (t.length) {
          setLibrary(t);
          setRemember(true);
        }
      })
      .catch(() => undefined);
  }, []);

  async function addFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter(isAudio);
    if (!files.length) return;
    const fresh = files.map(trackFromFile);
    setLibrary((old) => {
      const ids = new Set(fresh.map((t) => t.id));
      return [...old.filter((t) => !ids.has(t.id)), ...fresh];
    });
    if (remember) void saveTracks(fresh).catch(() => undefined);
    // Tags refine the filename guess a few at a time; matching works throughout.
    for (let i = 0; i < fresh.length; i += 4) {
      const batch = await Promise.all(fresh.slice(i, i + 4).map(withTags));
      setLibrary((old) => old.map((t) => batch.find((b) => b.id === t.id) ?? t));
    }
  }

  async function toggleRemember(on: boolean) {
    setRemember(on);
    if (on) await saveTracks(library).catch(() => undefined);
    else await clearTracks().catch(() => undefined);
  }

  // ---- playback ----------------------------------------------------------------------------
  const startFile = useCallback(
    async (id: string, track: LocalTrack, title: string, artist: string | null) => {
      const a = audio.current;
      if (!a || current.current) return;
      const url = URL.createObjectURL(track.file);
      current.current = { id, reported: false, url };
      setAudioId(id);
      a.src = url;
      try {
        await a.play();
        setUnlocked(true);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({ title, artist: artist ?? '' });
        }
      } catch {
        // Autoplay was refused (not unlocked yet): wait for a tap rather than looping.
        stopAudio();
        setUnlocked(false);
      }
    },
    [stopAudio],
  );

  // Auto-advance once audio is unlocked and the sound check is done.
  useEffect(() => {
    if (!reserved || !match || !unlocked || !soundChecked) return;
    if (leaseState !== 'held' || s?.view.state !== 'ACTIVE' || nowPlaying || current.current)
      return;
    void startFile(reserved.id, match.track, reserved.title, reserved.artist);
  }, [reserved, match, unlocked, soundChecked, leaseState, s?.view.state, nowPlaying, startFile]);

  async function onPlaying() {
    const c = current.current;
    const l = lease.current;
    if (!c || c.reported || !l) return;
    c.reported = true;
    try {
      await playerApi.started(eventId, l, c.id, (audio.current?.duration ?? 0) * 1000 || null);
      try {
        wake.current = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* optional */
      }
    } catch (e) {
      stopAudio();
      if (e instanceof ApiError && e.code === 'STALE_VERSION') {
        setNotice('The queue changed before that song started, so it was not counted.');
      }
      guard(e);
    }
    stream.refresh();
  }

  async function onEnded() {
    const c = current.current;
    const l = lease.current;
    if (!c || !l) return;
    stopAudio();
    if (c.reported) await playerApi.finished(eventId, l, c.id, 'PLAYED').catch(guard);
    stream.refresh();
  }

  async function onMediaError() {
    const c = current.current;
    const l = lease.current;
    if (!c || !l) return;
    stopAudio();
    if (c.reported) await playerApi.finished(eventId, l, c.id, 'FAILED').catch(guard);
    else setFailed((f) => new Set(f).add(c.id));
    setNotice('That file could not be played. Use manual mode or pick another file.');
    stream.refresh();
  }

  async function manualStart(id: string) {
    const l = lease.current;
    if (l) await playerApi.started(eventId, l, id, null).catch(guard);
    stream.refresh();
  }

  async function manualEnd(id: string) {
    const l = lease.current;
    if (l) await playerApi.finished(eventId, l, id, 'PLAYED').catch(guard);
    stream.refresh();
  }

  async function soundCheck() {
    setChecking(true);
    try {
      await playTone();
      setSoundChecked(true);
    } catch {
      setNotice('This browser could not play the test tone. Check the volume and output device.');
    } finally {
      setChecking(false);
    }
  }

  // Media Session + wake lock re-acquire (it is released when the tab is hidden).
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => void audio.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.current?.pause());
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, []);

  if (stream.error?.code === 'UNAUTHORISED' || (stream.error && !s)) {
    return (
      <main className="stack">
        <h1>Player</h1>
        <p className="error" role="alert">
          {stream.error.message} {stream.error.action}
        </p>
        <p>
          The player needs organiser access. Open your organiser link on this device first, then
          come back.
        </p>
        <Link className="btn" to={`/admin/${eventId}`}>
          Organiser page
        </Link>
      </main>
    );
  }
  if (!s) return <p role="status">Loading…</p>;

  const ended = s.view.state === 'ENDED' || s.view.state === 'ARCHIVED';
  const upcoming = s.view.queue.filter((q) => q.requestId !== reserved?.id).slice(0, 4);
  const manualPlayingId =
    nowPlaying && audioId !== nowPlaying.track.requestId ? nowPlaying.track.requestId : null;
  const canStart =
    leaseState === 'held' && soundChecked && s.view.state === 'ACTIVE' && !nowPlaying;

  return (
    <main className="stack">
      <header className="row between">
        <h1>Player · {s.view.name}</h1>
        <ConnectionBadge connection={stream.connection} />
      </header>

      {notice ? (
        <p className="warning" role="status">
          {notice}
        </p>
      ) : null}

      {leaseState === 'lost' ? (
        <section className="card stack" role="alert">
          <h2>Another device took over playback</h2>
          <p>This device has stopped. The song it was playing counts as played.</p>
          <button className="btn" onClick={() => void claim(true)}>
            Take playback back
          </button>
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="pc-h">
        <h2 id="pc-h">1 · Take the player role</h2>
        {leaseState === 'held' ? (
          <>
            <p>This device is playing (session {myEpoch}).</p>
            <button className="btn" onClick={() => void release()}>
              Release
            </button>
          </>
        ) : leaseState === 'busy' ? (
          <>
            <p>Another device is already the player.</p>
            <p className="muted small">
              Taking over stops it. Its current song counts as played, and you start the next one.
            </p>
            <button className="btn primary" onClick={() => void claim(true)}>
              Take over playback
            </button>
          </>
        ) : (
          <button
            className="btn primary"
            disabled={!csrf || ended}
            onClick={() => void claim(false)}
          >
            Use this device as the player
          </button>
        )}
      </section>

      <section className="card stack" aria-labelledby="sc-h">
        <h2 id="sc-h">2 · Sound check</h2>
        <p className="muted">
          Play a short chime through the speakers before the first song. Check the volume and the
          Bluetooth connection.
        </p>
        <button className="btn" disabled={checking} onClick={() => void soundCheck()}>
          {checking ? 'Playing…' : soundChecked ? 'Play the chime again' : 'Play test chime'}
        </button>
        {soundChecked ? <p role="status">Sound check done.</p> : null}
      </section>

      <section className="card stack" aria-labelledby="lib-h">
        <h2 id="lib-h">3 · Music on this device</h2>
        <p className="muted">
          Choose audio files you are allowed to play. They stay on this device and are never
          uploaded.
        </p>
        <label className="btn">
          Choose files
          <input
            type="file"
            multiple
            accept="audio/*"
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <label className="btn">
          Choose a folder
          <input
            type="file"
            multiple
            hidden
            {...{ webkitdirectory: '' }}
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <p>
          {library.length} {library.length === 1 ? 'file' : 'files'} loaded.
        </p>
        <label className="row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => void toggleRemember(e.target.checked)}
          />
          <span>
            Remember these files on this device
            <span className="muted small">
              {' '}
              Stores copies in this browser&apos;s private storage. Only tick this if the music
              owner permits copies, and untick to delete them. The browser may remove them; just
              choose the files again.
            </span>
          </span>
        </label>
      </section>

      <section className="card stack" aria-labelledby="np-h" aria-live="polite">
        <h2 id="np-h">Now</h2>
        {nowPlaying ? (
          <p className="big">
            {nowPlaying.track.title}
            {nowPlaying.track.artist ? ` — ${nowPlaying.track.artist}` : ''}
          </p>
        ) : (
          <p className="muted">Nothing is playing.</p>
        )}
        {/* Native controls keep the player usable without our UI (lock screen, headphones). */}
        <audio
          ref={audio}
          controls
          onPlaying={() => void onPlaying()}
          onEnded={() => void onEnded()}
          onError={() => void onMediaError()}
        />
        {manualPlayingId ? (
          <div className="stack">
            <p className="muted">
              This song was started by hand. Press the button when it has finished; the timer is
              never used to decide.
            </p>
            <button className="btn primary" onClick={() => void manualEnd(manualPlayingId)}>
              Mark ended
            </button>
          </div>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="nx-h">
        <h2 id="nx-h">Next</h2>
        {s.view.state === 'PAUSED' ? <p className="warning">The event is paused.</p> : null}
        {reserved ? (
          <div className="stack">
            <p className="big">
              {reserved.title}
              {reserved.artist ? ` — ${reserved.artist}` : ''}
            </p>
            <p className="muted">
              {reservedDuration ? `${formatCountdown(reservedDuration)} · ` : ''}
              {match
                ? match.kind === 'exact'
                  ? `File found: ${match.track.file.name}`
                  : `Probable file (title only): ${match.track.file.name}`
                : 'No matching file on this device.'}
            </p>
            {match ? (
              <button
                className="btn primary"
                disabled={!canStart}
                onClick={() =>
                  void startFile(reserved.id, match.track, reserved.title, reserved.artist)
                }
              >
                Start
              </button>
            ) : (
              <div className="stack">
                <label className="btn">
                  Choose a file for this song
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && isAudio(f)) {
                        setFailed((old) => {
                          const n = new Set(old);
                          n.delete(reserved.id);
                          return n;
                        });
                        setPicked((p) => ({ ...p, [reserved.id]: trackFromFile(f) }));
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="muted small">
                  Or play it another way and use manual mode. This cannot promise ad-free playback.
                </p>
                {reserved.sourceUrl ? (
                  <a
                    className="btn"
                    href={reserved.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the requester&apos;s link
                  </a>
                ) : null}
                <button
                  className="btn primary"
                  disabled={!canStart}
                  onClick={() => void manualStart(reserved.id)}
                >
                  Mark started
                </button>
              </div>
            )}
            {!canStart && !nowPlaying ? (
              <p className="muted small">
                {leaseState !== 'held'
                  ? 'Take the player role first.'
                  : !soundChecked
                    ? 'Do the sound check first.'
                    : 'Waiting for the event to be active.'}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="muted">{s.view.waitingReason ?? 'No song is reserved yet.'}</p>
        )}
        {upcoming.length ? (
          <ol className="small">
            {upcoming.map((q) => (
              <li key={q.requestId}>
                {q.title}
                {q.artist ? ` — ${q.artist}` : ''}{' '}
                {findMatch(library, q) ? '✓' : <span className="muted">(no file)</span>}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <ErrorLine error={error} />
      <p className="muted small">
        Only play recordings you are licensed to play at this venue. Qroove never streams or copies
        music. Browsers need one tap to start audio, and Bluetooth routing is controlled by the
        device.
      </p>
      <p>
        <Link to={`/admin/${eventId}`}>Back to organiser page</Link>
      </p>
    </main>
  );
}
