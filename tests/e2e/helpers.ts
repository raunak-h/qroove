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

export async function addSong(page: Page, title: string, artist: string, style: string) {
  await page.getByLabel(/Paste a Spotify/).fill(title);
  await page.getByLabel(/Artist/).fill(artist);
  await page.getByLabel(style, { exact: true }).check();
  await page.getByRole('button', { name: 'Add to queue' }).click();
  await expect(page.getByText(new RegExp(`Added “${title}”`))).toBeVisible();
}
