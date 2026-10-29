import { test } from '@playwright/test';
import { expectAccessible } from './helpers';

test('light theme passes the same accessibility checks', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('qroove:theme', 'light'));
  for (const path of ['/', '/new', '/privacy']) {
    await page.goto(path);
    await page.waitForSelector('main, section, h1');
    await expectAccessible(page, `${path} (light)`);
  }
});
