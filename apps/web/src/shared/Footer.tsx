import { BRAND, copyrightLine, shortCopyrightLine } from '@qroove/config';
import { useLocation } from 'react-router';

/** The landing page says who we are; every other page keeps the footer as thin as possible. */
export function Footer() {
  const { pathname } = useLocation();
  if (pathname !== '/') {
    return (
      <footer className="footer">
        <p>{shortCopyrightLine()}</p>
      </footer>
    );
  }
  return (
    <footer className="footer">
      <p>{copyrightLine()}</p>
      <p>{BRAND.initiative}</p>
      <p>
        <a href={BRAND.company.url} rel="noopener">
          Contact us
        </a>{' '}
        to know more. {BRAND.contactLine}
      </p>
    </footer>
  );
}
