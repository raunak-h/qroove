import type { StyleId } from '@qroove/config';
import { useLayoutEffect, useRef, useState } from 'react';
import { GenreSwatch } from './Genre';

export interface ListSong {
  id: string;
  title: string;
  artist: string | null;
  durationMs: number | null;
  sourceUrl: string | null;
  style?: StyleId;
}

const ROW = 60; // px: fixed, so dragging can be worked out with plain arithmetic
const THRESHOLD = 0.35; // share of the row's width a swipe must cover to count
const SLOP = 8; // px of sideways movement before a touch is a swipe

const Bin = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
const ArrowUp = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20V5M5 12l7-7 7 7" />
  </svg>
);

const move = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
};

/**
 * A sortable list of songs. Only the first `activeCount` can be added; the rest are greyed out and
 * can be promoted. Drag the grip to reorder; swipe left to remove (a red bin appears as you go);
 * swipe right on any song but the first to send it straight to the top (a green arrow appears).
 * Four hidden buttons per row do the same for keyboard and screen-reader users.
 */
export function SongList({
  songs,
  onChange,
  activeCount,
  label,
}: {
  songs: readonly ListSong[];
  onChange: (next: ListSong[]) => void;
  activeCount: number;
  label: string;
}) {
  const [swipe, setSwipe] = useState<{ id: string; dx: number; width: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; from: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const touch = useRef<{ id: string; x: number; y: number; width: number; active: boolean } | null>(
    null,
  );
  const dragStart = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const prevTops = useRef(new Map<string, number>());

  // A song that moved (to the top, say) slides from where it was to where it is now.
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    list.current?.querySelectorAll<HTMLElement>('[data-song]').forEach((el) => {
      const id = el.dataset.song!;
      const top = el.offsetTop;
      next.set(id, top);
      const was = prevTops.current.get(id);
      if (was !== undefined && was !== top) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${was - top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.25s ease';
          el.style.transform = '';
        });
      }
    });
    prevTops.current = next;
  });

  const toTop = (i: number) => i > 0 && onChange(move(songs, i, 0));
  const remove = (i: number) => {
    setLeaving(songs[i]!.id);
    setTimeout(() => {
      setLeaving(null);
      onChange(songs.filter((_, j) => j !== i));
    }, 160);
  };

  const target = drag
    ? Math.min(songs.length - 1, Math.max(0, Math.round(drag.from + drag.dy / ROW)))
    : -1;

  return (
    <ol className="songs" ref={list} aria-label={label}>
      {songs.map((s, i) => {
        const dx = swipe?.id === s.id ? swipe.dx : 0;
        let shift = 0;
        if (drag && s.id !== drag.id) {
          if (drag.from < target && i > drag.from && i <= target) shift = -ROW;
          else if (drag.from > target && i < drag.from && i >= target) shift = ROW;
        }
        const dragging = drag?.id === s.id;
        const progress = Math.min(1, Math.abs(dx) / ((swipe?.width ?? 300) * THRESHOLD));
        return (
          <li
            key={s.id}
            data-song={s.id}
            className={`song${i >= activeCount ? ' over' : ''}${i === activeCount ? ' edge' : ''}${
              leaving === s.id ? ' leaving' : ''
            }${dragging ? ' dragging' : ''}`}
            style={{ height: ROW, transform: shift ? `translateY(${shift}px)` : undefined }}
            aria-label={`${s.title}${s.artist ? `, ${s.artist}` : ''}${
              i >= activeCount ? ', over the limit' : ''
            }`}
          >
            <div
              className="song-bg add"
              style={{ opacity: dx > 0 ? progress : 0 }}
              aria-hidden="true"
            >
              <ArrowUp />
            </div>
            <div
              className="song-bg del"
              style={{ opacity: dx < 0 ? progress : 0 }}
              aria-hidden="true"
            >
              <Bin />
            </div>
            <div
              className="song-fg"
              style={{
                transform: `translate(${dx}px, ${dragging ? drag!.dy : 0}px)`,
                transition: swipe || dragging ? 'none' : 'transform 0.2s ease',
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('.grip, .song-actions')) return;
                const w = e.currentTarget.getBoundingClientRect().width || 300;
                touch.current = { id: s.id, x: e.clientX, y: e.clientY, width: w, active: false };
              }}
              onPointerMove={(e) => {
                const t = touch.current;
                if (!t || t.id !== s.id) return;
                const ddx = e.clientX - t.x;
                if (!t.active) {
                  if (Math.abs(ddx) < SLOP || Math.abs(e.clientY - t.y) > Math.abs(ddx)) return;
                  t.active = true;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                }
                // The first song cannot go "to the top": it is already there.
                setSwipe({ id: s.id, dx: i === 0 ? Math.min(0, ddx) : ddx, width: t.width });
              }}
              onPointerUp={() => {
                const t = touch.current;
                const d = swipe;
                touch.current = null;
                setSwipe(null);
                if (!t || !d || d.id !== s.id) return;
                if (d.dx <= -t.width * THRESHOLD) remove(i);
                else if (d.dx >= t.width * THRESHOLD) toTop(i);
              }}
              onPointerCancel={() => {
                touch.current = null;
                setSwipe(null);
              }}
            >
              <span
                className="grip"
                aria-hidden="true"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  dragStart.current = e.clientY;
                  setDrag({ id: s.id, from: i, dy: 0 });
                }}
                onPointerMove={(e) => {
                  if (drag?.id === s.id) setDrag({ ...drag, dy: e.clientY - dragStart.current });
                }}
                onPointerUp={() => {
                  if (drag?.id === s.id && target !== drag.from)
                    onChange(move(songs, drag.from, target));
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                ⠿
              </span>
              <span className="song-text">
                <span className="song-title">{s.title}</span>
                {s.artist ? <span className="song-artist">{s.artist}</span> : null}
              </span>
              {s.style ? <GenreSwatch style={s.style} size={16} /> : null}
              <span className="song-actions">
                <button
                  type="button"
                  aria-label={`Move ${s.title} up`}
                  disabled={i === 0}
                  onClick={() => onChange(move(songs, i, i - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${s.title} down`}
                  disabled={i === songs.length - 1}
                  onClick={() => onChange(move(songs, i, i + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Move ${s.title} to the top`}
                  disabled={i === 0}
                  onClick={() => toTop(i)}
                >
                  ⤒
                </button>
                <button type="button" aria-label={`Remove ${s.title}`} onClick={() => remove(i)}>
                  ✕
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
