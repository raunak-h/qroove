import { BRAND } from '@qroove/config';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

export function Landing() {
  const [code, setCode] = useState('');
  const go = useNavigate();
  return (
    <div className="stack">
      <section className="hero">
        <img
          className="logo"
          src="/icons/logo-256.png"
          width={160}
          height={160}
          alt={`${BRAND.product} mascot: a pixel-art Q wearing headphones, DJing`}
        />
        <h1>{BRAND.product}</h1>
        <p className="tagline">{BRAND.tagline}</p>
        <p>
          Everyone adds songs from their phone. Qroove plays them in a fair order, so no one
          dominates and the style keeps changing.
        </p>
      </section>
      <section className="card" aria-labelledby="jc-h">
        <h2 id="jc-h">Join with a code</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) go(`/e/${encodeURIComponent(c)}`);
          }}
        >
          <label htmlFor="code">Event code (6 characters)</label>
          <div className="row">
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={16}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <button type="submit" className="btn primary" disabled={!code.trim()}>
              Join
            </button>
          </div>
        </form>
      </section>
      <p>
        <Link to="/new" className="btn">
          Create an event
        </Link>{' '}
        <Link to="/import">Start from a saved playlist</Link>
      </p>
      <p className="muted small">
        {BRAND.initiative} by{' '}
        <a href={BRAND.company.url} rel="noopener">
          {BRAND.company.name}
        </a>
        . Pilot: {BRAND.pilotCommunity}. <Link to="/privacy">Privacy</Link>
      </p>
    </div>
  );
}
