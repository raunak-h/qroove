import type { RulesSnapshot } from '@qroove/contracts';
import { STYLE_PRESETS, genresOf } from '@qroove/config';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
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

const label = (id: string) => STYLE_PRESETS.find((s) => s.id === id)?.label ?? id;

export function RulesList({ rules }: { rules: RulesSnapshot }) {
  const genres = genresOf(rules.enabledStyles);
  const caps = genres.map((g) => `${label(g)} ${rules.runCaps[g]}`).join(' · ');
  return (
    <ul className="rules-list">
      <li>
        <strong>Styles:</strong> {rules.enabledStyles.map(label).join(', ')}
      </li>
      <li>
        <strong>Most songs in a row:</strong> {caps}
      </li>
      <li>
        <strong>Songs per person:</strong> {rules.submissionLimit} (played songs count)
      </li>
      <li>
        {genres.length > 1
          ? 'Nobody plays twice in a row, or again until the style has changed.'
          : 'Nobody plays twice in a row, or again until half of the other songs waiting have played.'}
      </li>
    </ul>
  );
}

/** Top-right menu: session rules (only on event pages), theme, privacy. */
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
      <button
        type="button"
        className="btn ghost"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen(!open)}
      >
        Menu
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
          <ThemeToggle />
          <Link to="/privacy" className="btn ghost" onClick={() => setOpen(false)}>
            Privacy
          </Link>
        </div>
      ) : null}
    </div>
  );
}
