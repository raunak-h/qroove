import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';

/** Fails on serious/critical WCAG A/AA violations, listing them in the message. */
export async function expectAccessible(page: Page, label: string) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`),
    `axe on ${label}`,
  ).toEqual([]);
}

export async function newPage(
  browser: Browser,
  contextOptions: Parameters<Browser['newContext']>[0],
) {
  const context = await browser.newContext(contextOptions);
  return { context, page: await context.newPage() };
}

/** Adds one song by link. The lookup is stubbed so the tests never depend on Spotify being up. */
export async function addSong(page: Page, title: string, artist: string, style: string) {
  await page.route('**/api/resolve-playlist', (route) =>
    route.fulfill({
      json: { tracks: [{ title, artist, durationMs: 200_000, sourceUrl: null }] },
    }),
  );
  await page.getByLabel('Search Spotify or paste a link').fill('https://open.spotify.com/track/x');
  await page.getByRole('radio', { name: style, exact: true }).check();
  await expect(page.getByRole('list', { name: 'Songs to add' })).toContainText(title);
  await page.getByRole('button', { name: 'Add 1 song to queue' }).click();
  await expect(page.getByText('1 added')).toBeVisible();
  await page.unroute('**/api/resolve-playlist');
}

export async function joinAs(page: Page, name: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Join this event' }).click();
}
