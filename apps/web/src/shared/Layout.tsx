import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BRAND } from '@qroove/config';
import { Footer } from './Footer';
import { ThemeToggle } from './ThemeToggle';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/" className="brand">
          {BRAND.product}
        </Link>
        <ThemeToggle />
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}
