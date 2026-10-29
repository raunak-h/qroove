import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 640 } });

async function overflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollHeight - el.clientHeight;
  });
}

test('landing and the organiser console fit a 360×640 phone without scrolling', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('textbox')).toHaveCount(6);
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  const created = await (
    await request.post('/api/events', {
      data: { name: 'Small', timezone: 'UTC', plannedDurationMin: 120 },
    })
  ).json();
  const hash = new URL(created.adminUrl).hash;
  await page.goto(`/a/${created.eventId}${hash}`);
  await expect(page.getByRole('heading', { name: 'Small' })).toBeVisible();
  await page.getByRole('button', { name: 'Start event' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  for (const tab of ['Queue', 'Invite', 'Player', 'More']) {
    await page.getByRole('tab', { name: tab }).click();
    expect(await overflow(page), `${tab} tab`).toBeLessThanOrEqual(1);
  }
  await page.getByRole('tab', { name: 'Invite' }).click();
  const qr = await page.getByRole('img', { name: /QR code/ }).boundingBox();
  expect(qr!.width).toBeGreaterThan(150); // still scannable at this size
});
