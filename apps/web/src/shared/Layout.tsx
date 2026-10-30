import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BRAND } from '@qroove/config';
import { Footer } from './Footer';
import { AppMenu, HeaderEventName } from './menu';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/" className="brand" aria-label={`${BRAND.product} home`}>
          <img className="logo" src="/icons/logo-256.png" width={44} height={44} alt="" />
        </Link>
        <HeaderEventName />
        <AppMenu />
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}
