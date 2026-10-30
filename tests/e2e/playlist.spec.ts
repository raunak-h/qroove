import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

const tracks = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((t) => ({
  title: t,
  artist: 'Band',
  durationMs: 200_000,
  sourceUrl: null,
}));

/** Drag across a row with the pointer: down, a few moves, up. */
async function swipe(
  page: import('@playwright/test').Page,
  row: import('@playwright/test').Locator,
  dx: number,
) {
  await row.scrollIntoViewIfNeeded();
  const b = (await row.boundingBox())!;
  const y = b.y + b.height / 2;
  const x = b.x + b.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + 1);
  await page.mouse.up();
}

test('a guest sorts a playlist by swiping, then adds only the songs they have room for', async ({
  page,
  request,
}) => {
  await page.route('**/api/resolve-playlist', (route) => route.fulfill({ json: { tracks } }));
  const created = await (
    await request.post('/api/events', {
      data: {
        timezone: 'UTC',
        plannedDurationMin: 120,
        enabledStyles: ['salsa', 'bachata'],
        submissionLimit: 3,
      },
    })
  ).json();
  const admin = await page.context().browser()!.newContext();
  const a = await admin.newPage();
  await a.goto(`/a/${created.eventId}${new URL(created.adminUrl).hash}`);
  await a.getByRole('button', { name: 'Start event' }).click();
  await expect(a.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.goto(`/e/${created.slug}`);
  await page.getByRole('button', { name: 'Join this event' }).click();
  await page.getByLabel('Add a playlist').click();
  await page
    .getByLabel(/Playlist link/)
    .fill('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
  const list = page.getByRole('list', { name: 'Playlist songs' });
  const rows = list.getByRole('listitem');
  await expect(rows).toHaveCount(5);
  // Three songs allowed: the fourth and fifth are greyed out.
  await expect(rows.nth(3)).toHaveClass(/over/);
  await expect(rows.nth(2)).not.toHaveClass(/over/);
  await expectAccessible(page, '/e/:slug (playlist list)');

  // Swipe right on the last song: a green arrow shows, and it slides to the top.
  await swipe(page, rows.nth(4).locator('.song-fg'), 220);
  await expect(rows.first()).toHaveAccessibleName(/^Echo/);
  // Swipe left on the second song (Alpha): it is removed.
  await swipe(page, rows.nth(1).locator('.song-fg'), -240);
  await expect(rows).toHaveCount(4);
  await expect(list.getByText('Alpha')).toHaveCount(0);
  // Now Echo, Bravo, Charlie are active and Delta is greyed out.
  await expect(rows.nth(3)).toHaveClass(/over/);

  await page.getByRole('button', { name: 'Add 3' }).click();
  await expect(page.getByText(/3 added/)).toBeVisible();
  const mine = page.getByRole('heading', { name: 'My songs' }).locator('..');
  await expect(mine.getByText('Echo')).toBeVisible();
  await expect(mine.getByText('Delta')).toHaveCount(0);
  await admin.close();
});
