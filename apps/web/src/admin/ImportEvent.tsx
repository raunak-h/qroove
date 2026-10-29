import type { ExportSnapshot } from '@qroove/contracts';
import { useState } from 'react';
import { CreatedPanel } from './CreateEvent';
import type { Created } from './adminApi';
import { ImportPicker } from './panels';

function parse(text: string): ExportSnapshot | string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return 'That is not valid JSON. Paste the whole file, or choose it with the button.';
  }
  const o = v as Partial<ExportSnapshot> | null;
  if (!o || o.formatVersion !== 1 || !Array.isArray(o.recommendations)) {
    return 'This does not look like a Qroove playlist export.';
  }
  if (o.recommendations.length === 0) return 'The export has no songs.';
  return o as ExportSnapshot;
}

/** `/import` — start a new event from a playlist exported earlier (pasted or uploaded JSON). */
export default function ImportEvent() {
  const [text, setText] = useState('');
  const [snap, setSnap] = useState<ExportSnapshot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) return <CreatedPanel created={created} />;

  function load(t: string) {
    const r = parse(t);
    if (typeof r === 'string') {
      setProblem(r);
      setSnap(null);
    } else {
      setProblem(null);
      setSnap(r);
    }
  }

  return (
    <section className="card stack" aria-labelledby="im-h">
      <h1 id="im-h">Start from a saved playlist</h1>
      <p className="muted">
        Use the JSON export of a past event. It contains songs and styles only, never people.
      </p>
      <label className="btn">
        Choose a file
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void f.text().then((t) => {
                setText(t);
                load(t);
              });
            e.target.value = '';
          }}
        />
      </label>
      <label>
        Or paste it here
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="button" className="btn" disabled={!text.trim()} onClick={() => load(text)}>
        Read playlist
      </button>
      {problem ? (
        <p className="error" role="alert">
          {problem}
        </p>
      ) : null}
      {snap ? (
        <ImportPicker
          snapshot={snap}
          timezone={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
          name={snap.name.slice(0, 80)}
          intro={`${snap.recommendations.length} songs found. Pick the ones to bring in; they follow the same fairness rules as any request.`}
          onCreated={setCreated}
        />
      ) : null}
    </section>
  );
}
