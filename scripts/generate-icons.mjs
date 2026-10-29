// Regenerates every raster brand asset from brand/qroove-logo.png (transparent pixel-art logo).
// Run: pnpm icons. Uses nearest-neighbour so the pixel art stays crisp.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logo = resolve(root, 'brand/qroove-logo.png');
const icons = resolve(root, 'apps/web/public/icons');
const docsPublic = resolve(root, 'docs/src/public');
const BACKING = '#fff4dc'; // light warm backing: the logo has dark outlines, so opaque assets need a light ground

await Promise.all([mkdir(icons, { recursive: true }), mkdir(docsPublic, { recursive: true })]);

// The logo has generous transparent padding; trim it so icons use the space well.
const trimmed = await sharp(logo).trim().png().toBuffer();

const resized = (size) =>
  sharp(trimmed)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'nearest',
    })
    .png()
    .toBuffer();

const onBacking = async (canvasW, canvasH, logoSize, radiusFrac = 0) => {
  const base = sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: BACKING },
  });
  let img = base.composite([{ input: await resized(logoSize), gravity: 'centre' }]).png();
  if (radiusFrac) {
    const r = Math.round(canvasW * radiusFrac);
    const mask = Buffer.from(
      `<svg width="${canvasW}" height="${canvasH}"><rect width="100%" height="100%" rx="${r}" ry="${r}"/></svg>`,
    );
    img = sharp(await img.toBuffer())
      .composite([{ input: mask, blend: 'dest-in' }])
      .png();
  }
  return img.toBuffer();
};

const out = async (dir, name, buf) => sharp(buf).toFile(resolve(dir, name));

// Transparent "any" icons (work on light and dark launchers/tabs)
for (const s of [32, 48, 192, 512]) await out(icons, `icon-${s}.png`, await resized(s));
// Maskable: opaque, logo inside the 80% safe zone
await out(icons, 'icon-maskable-512.png', await onBacking(512, 512, 400));
// iOS home screen (no transparency allowed)
await out(icons, 'apple-touch-icon.png', await onBacking(180, 180, 144));
// In-app header/landing logo + Gravatar/profile picture (transparent)
await out(icons, 'logo-256.png', await resized(256));
await out(icons, 'avatar-512.png', await onBacking(512, 512, 440, 0.5));
// Social/link preview (Open Graph / Twitter): 1200x630
await out(icons, 'og-image.png', await onBacking(1200, 630, 520));

// Docs site
await out(docsPublic, 'logo.png', await resized(256));
await out(docsPublic, 'favicon.png', await resized(48));
await out(docsPublic, 'og-image.png', await onBacking(1200, 630, 520));
console.log('icons generated');
