import { BRAND, footerText } from '@qroove/config';

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
      </p>
      <nav aria-label="Project links">
        <a href={BRAND.docsPath}>Docs</a>
        <a href={BRAND.repoUrl} rel="noopener">
          Source
        </a>
      </nav>
    </footer>
  );
}
