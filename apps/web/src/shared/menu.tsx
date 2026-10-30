import type { RulesSnapshot } from '@qroove/contracts';
import { BRAND, genresOf } from '@qroove/config';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { GenreDot, StyleSwatches } from './Genre';
import { ThemeToggle } from './ThemeToggle';

const RulesCtx = createContext<{
  rules: RulesSnapshot | null;
  setRules: (r: RulesSnapshot | null) => void;
}>({ rules: null, setRules: () => {} });

export function MenuProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<RulesSnapshot | null>(null);
  return <RulesCtx.Provider value={{ rules, setRules }}>{children}</RulesCtx.Provider>;
}

/** Pages with an event publish its rules here so the header menu can show them. */
export function useMenuRules(rules: RulesSnapshot | null | undefined) {
  const { setRules } = useContext(RulesCtx);
  useEffect(() => {
    setRules(rules ?? null);
    return () => setRules(null);
  }, [rules, setRules]);
}

export function RulesList({ rules }: { rules: RulesSnapshot }) {
  const single = rules.segments.length === 1;
  return (
    <ul className="rules-list">
      {rules.segments.map((seg, i) => {
        const genres = genresOf(seg.enabledStyles);
        return (
          <li key={i}>
            {single ? null : <strong>{i + 1}. </strong>}
            <StyleSwatches styles={seg.enabledStyles} size={16} />{' '}
            {genres.map((g) => (
              <span key={g} className="cap">
                <GenreDot genre={g} size={12} />×{seg.runCaps[g]}
              </span>
            ))}
            <span className="muted small">
              {genres.length > 1 ? ' · style change' : ' · half of the others first'}
            </span>
          </li>
        );
      })}
      <li>
        <strong>{rules.submissionLimit}</strong> songs each
      </li>
    </ul>
  );
}

const Burger = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

/** Top-right controls: the sun/moon toggle and the three-line menu (Docs, Privacy, Source; rules on event pages). */
export function AppMenu() {
  const { rules } = useContext(RulesCtx);
  const [open, setOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className="menu">
      <ThemeToggle />
      <button
        type="button"
        className="btn ghost icon-btn"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen(!open)}
      >
        <Burger />
      </button>
      {open ? (
        <div id="app-menu" className="menu-panel card" role="group" aria-label="Menu">
          {rules ? (
            <div>
              <button
                type="button"
                className="btn ghost"
                aria-expanded={showRules}
                onClick={() => setShowRules(!showRules)}
              >
                Session rules {showRules ? '▴' : '▾'}
              </button>
              {showRules ? <RulesList rules={rules} /> : null}
            </div>
          ) : null}
          <a href={BRAND.docsPath} className="btn ghost">
            Docs
          </a>
          <Link to="/privacy" className="btn ghost" onClick={() => setOpen(false)}>
            Privacy
          </Link>
          <a href={BRAND.repoUrl} className="btn ghost" rel="noopener">
            Source
          </a>
        </div>
      ) : null}
    </div>
  );
}
