import sharp from 'sharp';

import { BrowExportError } from '../lib/brow-export';
import { browLettering } from '../lib/brow-lettering';

export const MAX_BROW_IMAGE_BYTES = 25 * 1024 * 1024;
const imageOptions = { limitInputPixels: 40_000_000, animated: false };

export async function normalizeBrowExport(image: Buffer): Promise<Buffer> {
  return sharp(image, imageOptions).rotate().png().toBuffer();
}

export async function renderBrowPreview(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image, imageOptions)
    .rotate()
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  // A compact corner signature leaves the portrait and brow area unobstructed.
  // Scale as one unit for small historical images; never enlarge the source.
  const scale = Math.min(1, info.width / 320, info.height / 240);
  const badgeWidth = 148;
  const badgeHeight = 36;
  const inset = 16 * scale;
  const left = info.width - badgeWidth * scale - inset;
  const top = info.height - badgeHeight * scale - inset;
  const label = Buffer.from(
    `<svg width="${info.width}" height="${info.height}"><g transform="translate(${left} ${top}) scale(${scale})"><rect x="0.5" y="0.5" width="147" height="35" rx="12" fill="#fffdfa" fill-opacity="0.88" stroke="#27211e" stroke-opacity="0.12"/><g fill="#27211e">${browLettering('Browlens', { x: 12, y: 22, size: 14, maxWidth: 68 })}</g><g fill="#665c57">${browLettering('Preview', { x: 88, y: 22, size: 10, maxWidth: 48 })}</g></g></svg>`
  );
  return sharp(data)
    .composite([{ input: label }])
    .jpeg({ quality: 78 })
    .toBuffer();
}

export async function composeBrowComparison(
  items: { image: Buffer; label: string }[]
): Promise<Buffer> {
  if (items.length < 2 || items.length > 4)
    throw new BrowExportError('invalid_selection');
  const width = 1200,
    height = 1600,
    gap = 16,
    header = 108,
    caption = 32;
  const columns = 2,
    rows = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = header + rows * (height + caption + gap);
  const overlays: sharp.OverlayOptions[] = [];
  for (let index = 0; index < items.length; index++) {
    const left = gap + (index % columns) * (width + gap);
    const top = header + Math.floor(index / columns) * (height + caption + gap);
    overlays.push({
      input: await sharp(items[index].image, imageOptions)
        .rotate()
        .resize(width, height, { fit: 'contain', background: '#f6f3ef' })
        .png()
        .toBuffer(),
      left,
      top,
    });
  }
  const text = items
    .map((item, index) =>
      browLettering(item.label, {
        x: gap + (index % columns) * (width + gap) + width / 2,
        y:
          header +
          Math.floor(index / columns) * (height + caption + gap) +
          height +
          27,
        size: 26,
        maxWidth: width - 32,
        centered: true,
      })
    )
    .join('');
  overlays.push({
    input: Buffer.from(
      `<svg width="${canvasWidth}" height="${canvasHeight}"><g fill="#27211e">${browLettering('Browlens', { x: 24, y: 48, size: 36, maxWidth: canvasWidth - 48 })}${browLettering('Eyebrow style comparison', { x: 24, y: 82, size: 24, maxWidth: canvasWidth - 48 })}${text}</g></svg>`
    ),
    left: 0,
    top: 0,
  });
  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#fffdfa',
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
