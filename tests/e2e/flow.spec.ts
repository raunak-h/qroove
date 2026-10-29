import { expect, test } from '@playwright/test';
import { addSong, expectAccessible, newPage } from './helpers';

test('create → run → play manually → hand over → end → carry over', async ({
  browser,
  page,
  baseURL,
}, info) => {
  const device = info.project.use;
  const ctxOpts = { ...device, baseURL };

  // Landing and creation -------------------------------------------------------------------
  await page.goto('/');
  await expectAccessible(page, '/');
  await page.getByRole('link', { name: 'Create an event' }).click();
  await expectAccessible(page, '/new');
  await page.getByLabel('Event name').fill('E2E Social');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByText(/Save this link/)).toBeVisible();
  const slug = (await page.locator('strong.code').innerText()).trim();
  const adminUrl = (await page.locator('p.mono').first().innerText()).trim();
  expect(adminUrl).toContain('#k=');
  await page.getByRole('link', { name: 'Open organiser page' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Social' })).toBeVisible();
  await expectAccessible(page, '/admin (draft)');
  const eventId = new URL(page.url()).pathname.split('/').pop()!;

  await page.getByRole('button', { name: 'Start event' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  // Three attendees, each in a private context ---------------------------------------------
  const people = [] as Awaited<ReturnType<typeof newPage>>[];
  for (const [i, [title, artist, style]] of [
    ['Song One', 'Band A', 'Salsa'],
    ['Song Two', 'Band B', 'Bachata'],
    ['Song Three', 'Band C', 'Salsa'],
  ].entries()) {
    const p = await newPage(browser, ctxOpts);
    people.push(p);
    await p.page.goto(`/e/${slug}`);
    await p.page.getByRole('button', { name: 'Join this event' }).click();
    if (i === 0) await expectAccessible(p.page, '/e/:slug (joined)');
    await addSong(p.page, title!, artist!, style!);
  }

  // Organiser sees all three requests -------------------------------------------------------
  await expect(page.getByText('Song Two').first()).toBeVisible();
  await expect(page.getByText('Song Three').first()).toBeVisible();

  // Player in manual mode (no local file) ---------------------------------------------------
  const player = await newPage(browser, ctxOpts);
  await player.page.goto(`/a/${eventId}${adminUrl.slice(adminUrl.indexOf('#'))}`);
  await expect(player.page.getByRole('heading', { name: 'E2E Social' })).toBeVisible();
  await player.page.goto(`/player/${eventId}`);
  await expect(player.page.getByText(/No matching file on this device/)).toBeVisible();
  await expectAccessible(player.page, '/player');
  await player.page.getByRole('button', { name: 'Use this device as the player' }).click();
  await expect(player.page.getByText(/This device is playing/)).toBeVisible();
  await player.page.getByRole('button', { name: 'Play test chime' }).click();
  await expect(player.page.getByText('Sound check done.')).toBeVisible();
  await player.page.getByRole('button', { name: 'Mark started' }).click();
  await expect(player.page.getByRole('button', { name: 'Mark ended' })).toBeVisible();

  // Attendee countdown/now-playing follows ----------------------------------------------------
  await expect(people[0]!.page.getByText('Now playing').first()).toBeVisible();
  await player.page.getByRole('button', { name: 'Mark ended' }).click();
  await expect(player.page.getByRole('button', { name: 'Mark ended' })).toBeHidden();

  // Handover: the new admin works, the old one is rejected -----------------------------------
  await page.getByRole('button', { name: 'Hand over admin' }).click();
  await page.getByRole('button', { name: 'Yes, create a handover link' }).click();
  const claim = (await page.locator('p.mono', { hasText: '/claim/' }).innerText()).trim();
  const second = await newPage(browser, ctxOpts);
  await second.page.goto(claim);
  await expect(second.page.getByRole('heading', { name: 'E2E Social' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/You do not have organiser access/)).toBeVisible();

  // End and carry over ----------------------------------------------------------------------
  const admin = second.page;
  await admin
    .getByRole('button', { name: 'Resume' })
    .click()
    .catch(() => undefined);
  await admin.getByLabel('Type END to confirm').fill('END');
  await admin.getByRole('button', { name: 'End event' }).click();
  await expect(admin.getByRole('heading', { name: 'Carry over to a new event' })).toBeVisible();
  await expectAccessible(admin, '/admin (ended)');
  await admin.getByRole('button', { name: 'Create event from these' }).click();
  await expect(admin.getByText(/Save this link/)).toBeVisible();

  // Remaining public pages ------------------------------------------------------------------
  await page.goto('/privacy');
  await expectAccessible(page, '/privacy');
  await page.goto('/import');
  await expectAccessible(page, '/import');
  await page.goto(`/h/${slug}`);
  await expect(page.getByRole('heading', { name: 'E2E Social' })).toBeVisible();
  await expectAccessible(page, '/h/:slug');

  for (const p of [...people, player, second]) await p.context.close();
});
