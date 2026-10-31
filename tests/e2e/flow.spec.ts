import { expect, test, type Page } from '@playwright/test';
import { addSong, joinAs, expectAccessible, newPage } from './helpers';

/** The page never needs vertical scrolling (the queue list is the one allowed exception). */
async function expectNoScroll(page: Page, label: string) {
  const over = await page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollHeight - el.clientHeight;
  });
  expect(over, `${label} should fit the screen`).toBeLessThanOrEqual(1);
}

test('create → run → play manually → hand over → end → carry over', async ({
  browser,
  page,
  baseURL,
}, info) => {
  const ctxOpts = { ...info.project.use, baseURL };

  // Landing: code boxes first, one screen --------------------------------------------------
  await page.goto('/');
  await expect(page.getByRole('textbox')).toHaveCount(6);
  await expect(page.getByRole('link', { name: 'Qroove home' })).toBeVisible();
  await expectNoScroll(page, 'landing');
  await expectAccessible(page, '/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expectAccessible(page, '/ (menu open)');
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Create an event' }).click();
  await expectAccessible(page, '/new');
  // No name field: the server names the event from neutral words.
  await expect(page.getByLabel(/event name/i)).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Planned time' })).toHaveAttribute(
    'aria-valuetext',
    '2:00',
  );
  // A plain tap on the bar only selects a part; pressing and holding adds a break in its middle.
  const part1 = page.getByRole('button', { name: /^Part 1 of 1/ });
  await part1.click();
  await expect(page.getByRole('button', { name: /^Part/ })).toHaveCount(1);
  const box = (await part1.boundingBox())!;
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /^Part/ })).toHaveCount(2);
  await expect(page.getByRole('slider', { name: 'Break 1', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '60',
  );
  await expectAccessible(page, '/new (with a break)');
  // Creating goes straight to the organiser page: no interstitial, no link or recovery secret shown.
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/events') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create event' }).click();
  const made = (await (await created).json()) as { adminUrl: string };
  const adminUrl = made.adminUrl;
  expect(adminUrl).toContain('#k=');
  await expect(page).toHaveURL(/\/admin\//);
  await expect(page.getByText(/Save this link|recovery/i)).toHaveCount(0);
  const eventName = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  expect(eventName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/);
  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  const eventId = new URL(page.url()).pathname.split('/').pop()!;

  // The organiser console fits one screen on every tab except the queue list ----------------
  await expectNoScroll(page, 'console (queue, empty)');
  await expectAccessible(page, '/admin (draft)');
  await page.getByRole('tab', { name: 'Invite' }).click();
  await expect(page.getByRole('img', { name: /QR code to join/ })).toBeVisible();
  // The permanent room code is shown as two triplets, with the QR as a backup.
  await expect(page.getByText(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/)).toBeVisible();
  await expectNoScroll(page, 'console (invite)');
  await page.getByRole('tab', { name: 'More' }).click();
  await expectNoScroll(page, 'console (more)');
  await page.getByRole('tab', { name: 'Playing' }).click();

  // Right-click is blocked on the organiser page ---------------------------------------------
  const blocked = await page.evaluate(() => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(blocked).toBe(true);

  await page.getByRole('button', { name: 'Start event' }).click();
  await expect(page.getByRole('button', { name: 'Pause At End of Current Song' })).toBeVisible();

  // The QR code opens the same public link the typed room code leads to ----------------------
  const state = await (await page.request.get(`/api/events/${eventId}/admin/state`)).json();
  const joinUrl = new URL(state.joinUrl);
  const slug = joinUrl.pathname.split('/').pop()!;
  expect(joinUrl.hash).toBe('');

  // Typing the room code on the landing page is enough to get in and join ---------------------
  const typed = await newPage(browser, ctxOpts);
  await typed.page.goto('/');
  await typed.page.getByRole('textbox').first().click();
  await typed.page.keyboard.type(slug.toLowerCase());
  await expect(typed.page).toHaveURL(new RegExp(`/e/${slug}$`));
  await expect(typed.page.getByRole('button', { name: 'Join this event' })).toBeVisible();

  // Three attendees join through the link in the QR code ---------------------------------------------------
  const people = [] as Awaited<ReturnType<typeof newPage>>[];
  for (const [i, [title, artist, style]] of [
    ['Song One', 'Band A', 'Salsa'],
    ['Song Two', 'Band B', 'Bachata'],
    ['Song Three', 'Band C', 'Salsa'],
  ].entries()) {
    const p = await newPage(browser, ctxOpts);
    people.push(p);
    await p.page.goto(joinUrl.pathname);
    await expect(p.page.getByRole('button', { name: 'Join this event' })).toBeVisible();
    await joinAs(p.page, `Guest ${i + 1}`);
    if (i === 0) await expectAccessible(p.page, '/e/:slug (joined)');
    await addSong(p.page, title!, artist!, style!);
  }

  // The 10-minute break shows in the attendees' queue at the midpoint of the plan -------------
  await expect(people[0]!.page.getByText(/Break · 10 min/)).toBeVisible();

  // Organiser sees all three requests -------------------------------------------------------
  await expect(page.getByText('Song Two').first()).toBeVisible();
  await expect(page.getByText('Song Three').first()).toBeVisible();

  // Player in manual mode (no local file) ---------------------------------------------------
  const player = await newPage(browser, ctxOpts);
  await player.page.goto(`/a/${eventId}${adminUrl.slice(adminUrl.indexOf('#'))}`);
  await expect(player.page.getByRole('heading', { name: eventName })).toBeVisible();
  await expectAccessible(player.page, '/admin (player)');
  await player.page.getByRole('button', { name: 'Mark started' }).click();
  await expect(player.page.getByRole('button', { name: 'Mark ended' })).toBeVisible();

  await expect(people[0]!.page.getByText('Now playing').first()).toBeVisible();
  await player.page.getByRole('button', { name: 'Mark ended' }).click();
  await expect(player.page.getByRole('button', { name: 'Mark ended' })).toBeHidden();

  // Handover: the new admin works, the old one is rejected -----------------------------------
  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Hand over', exact: true }).click();
  await page.getByRole('button', { name: 'Hand over admin' }).click();
  await page.getByRole('button', { name: 'Yes, create a handover link' }).click();
  const claim = (await page.locator('p.mono', { hasText: '/claim/' }).innerText()).trim();
  const second = await newPage(browser, ctxOpts);
  await second.page.goto(claim);
  await expect(second.page.getByRole('heading', { name: eventName })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/You do not have organiser access/)).toBeVisible();

  // End with two clicks and no typing, then carry over ------------------------------------------
  const admin = second.page;
  await admin
    .getByRole('button', { name: 'Resume Playback' })
    .click()
    .catch(() => undefined);
  await admin.getByRole('tab', { name: 'More' }).click();
  await admin.getByRole('button', { name: 'End the event' }).click();
  await expect(admin.getByRole('textbox')).toHaveCount(0);
  await admin.getByRole('button', { name: 'End event' }).click();
  await admin.getByRole('button', { name: 'Yes, end the event now' }).click();
  await expect(admin.getByRole('heading', { name: 'Carry over to a new event' })).toBeVisible();
  await expectAccessible(admin, '/admin (ended)');
  await admin.getByRole('button', { name: 'Create event from these' }).click();
  // The carried-over event opens straight on its own organiser page, with a new generated name.
  await expect(admin.getByRole('heading', { level: 1 })).not.toHaveText(eventName);
  await expect(admin.getByRole('button', { name: 'Start event' })).toBeVisible();

  // Remaining public pages ------------------------------------------------------------------
  await page.goto('/privacy');
  await expectAccessible(page, '/privacy');
  await page.goto(`/h/${slug}`);
  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  await expectAccessible(page, '/h/:slug');

  for (const p of [typed, ...people, player, second]) await p.context.close();
});
