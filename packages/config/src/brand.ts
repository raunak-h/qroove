export const BRAND = {
  product: 'Qroove',
  tagline: 'Fair, collaborative music queues for dance socials.',
  company: { name: 'Sataklela OÜ', url: 'https://sataklela.com' },
  initiative: 'A CSR initiative',
  licence: { name: 'AGPL-3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
  copyleftYear: 2026,
  // Single place to change on org transfer.
  repoUrl: 'https://github.com/raunak-h/qroove',
  siteUrl: 'https://qroove.sataklela.com',
  docsPath: '/docs',
  pilotCommunity: 'LSU Salsa Society (pilot community; not an endorsement)',
} as const;

export const footerText = (): string =>
  `Copyleft 🄯 ${BRAND.copyleftYear} ${BRAND.company.name} · ${BRAND.initiative} · ${BRAND.licence.name}`;
