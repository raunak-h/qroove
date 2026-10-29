import { useState } from 'react';
import { currentTheme, setTheme } from './storage';

export function ThemeToggle() {
  const [theme, set] = useState(currentTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn ghost"
      onClick={() => {
        setTheme(next);
        set(next);
      }}
    >
      {next === 'light' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
