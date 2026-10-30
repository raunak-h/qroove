import { useState } from 'react';
import { currentTheme, setTheme } from './storage';

const Sun = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
  >
    <path d="M21 13.2A8.5 8.5 0 1 1 10.8 3a6.7 6.7 0 0 0 10.2 10.2z" />
  </svg>
);

/** Sun and moon toggle: shows the mode you would switch to. */
export function ThemeToggle() {
  const [theme, set] = useState(currentTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn ghost icon-btn"
      aria-label={next === 'light' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={next === 'light' ? 'Light mode' : 'Dark mode'}
      onClick={() => {
        setTheme(next);
        set(next);
      }}
    >
      {next === 'light' ? <Sun /> : <Moon />}
    </button>
  );
}
