import { BRAND, footerText } from '@qroove/config';

/** One thin line of small text (it wraps to two on a narrow phone). */
export function Footer() {
  const text = footerText();
  const [before, after] = text.split(BRAND.company.name) as [string, string];
  return (
    <footer className="footer">
      <p>
        {before}
        <a href={BRAND.company.url} rel="noopener">
          {BRAND.company.name}
        </a>
        {after}
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <a href={BRAND.docsPath}>Docs</a>
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <a href={BRAND.repoUrl} rel="noopener">
          Source
        </a>
      </p>
    </footer>
  );
}
