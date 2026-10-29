import type { ReactNode } from 'react';
import { Footer } from './Footer';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <main>{children}</main>
      <Footer />
    </div>
  );
}
