import { defineConfig } from 'vitepress';
import { BRAND } from '../../packages/config/src/brand';

export default defineConfig({
  srcDir: 'src',
  base: `${BRAND.docsPath}/`,
  title: `${BRAND.product} Docs`,
  description: BRAND.tagline,
  cleanUrls: true,
  lastUpdated: false,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/attendee' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'API', link: '/api/reference' },
      { text: 'Runbook', link: '/runbook/deploy' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      { text: 'Start', items: [{ text: 'Getting started', link: '/getting-started' }] },
      {
        text: 'Guide',
        items: [
          { text: 'Attendees', link: '/guide/attendee' },
          { text: 'Organisers', link: '/guide/admin' },
          { text: 'Player', link: '/guide/player' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Overview', link: '/architecture/overview' },
          { text: 'Scheduler', link: '/architecture/scheduler' },
          { text: 'Data model', link: '/architecture/data-model' },
          { text: 'Realtime', link: '/architecture/realtime' },
          { text: 'Security', link: '/architecture/security' },
        ],
      },
      { text: 'API', items: [{ text: 'Reference', link: '/api/reference' }] },
      {
        text: 'Runbook',
        items: [
          { text: 'Deploy', link: '/runbook/deploy' },
          { text: 'DNS (Cloudflare)', link: '/runbook/dns-cloudflare' },
          { text: 'Firebase', link: '/runbook/firebase' },
          { text: 'Backup', link: '/runbook/backup' },
          { text: 'Transfer ownership', link: '/runbook/transfer-ownership' },
        ],
      },
      {
        text: 'Decisions',
        items: [
          { text: '0001 Firestore', link: '/adr/0001-firestore' },
          { text: '0002 Single service', link: '/adr/0002-single-service' },
          { text: '0003 AGPL', link: '/adr/0003-agpl' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Privacy', link: '/privacy' },
          { text: 'Threat model', link: '/threat-model' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: BRAND.repoUrl }],
    search: { provider: 'local' },
    footer: {
      message: `Released under the ${BRAND.licence.name}.`,
      copyright: `Copyleft 🄯 ${BRAND.copyleftYear} <a href="${BRAND.company.url}" rel="noopener">${BRAND.company.name}</a> · ${BRAND.initiative}`,
    },
  },
});
