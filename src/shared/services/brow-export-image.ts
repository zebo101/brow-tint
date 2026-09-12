import sharp from 'sharp';

import { BrowExportError } from '../lib/brow-export';

export const MAX_BROW_IMAGE_BYTES = 25 * 1024 * 1024;
const imageOptions = { limitInputPixels: 40_000_000, animated: false };
const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!
  );

export async function normalizeBrowExport(image: Buffer): Promise<Buffer> {
  return sharp(image, imageOptions).rotate().png().toBuffer();
}

export async function renderBrowPreview(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image, imageOptions)
    .rotate()
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const label = Buffer.from(
    `<svg width="${info.width}" height="${info.height}"><rect x="0" y="${Math.max(0, info.height - 36)}" width="100%" height="36" fill="#fff" fill-opacity="0.78"/><text x="50%" y="${Math.max(18, info.height - 12)}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#27211e">Browlens · Preview</text></svg>`
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
    .map(
      (item, index) =>
        `<text x="${gap + (index % columns) * (width + gap) + width / 2}" y="${header + Math.floor(index / columns) * (height + caption + gap) + height + 27}" text-anchor="middle" font-size="26">${escapeXml(item.label.slice(0, 60))}</text>`
    )
    .join('');
  overlays.push({
    input: Buffer.from(
      `<svg width="${canvasWidth}" height="${canvasHeight}"><g font-family="sans-serif" fill="#27211e"><text x="24" y="48" font-size="36" font-weight="600">Browlens</text><text x="24" y="82" font-size="24">Eyebrow style comparison</text>${text}</g></svg>`
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
