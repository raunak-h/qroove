import { BRAND } from '@qroove/config';

export function Landing() {
  return (
    <section className="hero">
      <img
        className="logo"
        src="/icons/logo-256.png"
        width={160}
        height={160}
        alt={`${BRAND.product} mascot: a pixel-art Q wearing headphones, DJing`}
      />
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
