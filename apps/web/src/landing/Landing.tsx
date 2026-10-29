import { BRAND } from '@qroove/config';

export function Landing() {
  return (
    <section className="hero">
      <h1>{BRAND.product}</h1>
      <p className="tagline">{BRAND.tagline}</p>
      <p>
        {BRAND.initiative} by{' '}
        <a href={BRAND.company.url} rel="noopener">
          {BRAND.company.name}
        </a>
        . Pilot: {BRAND.pilotCommunity}.
      </p>
    </section>
  );
}
