import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

import {
  composeBrowComparison,
  renderBrowPreview,
} from '../../src/shared/services/brow-export-image';

async function main() {
  const image = process.env.BROW_RENDER_SOURCE
    ? readFileSync(process.env.BROW_RENDER_SOURCE)
    : await sharp({
        create: { width: 480, height: 640, channels: 3, background: '#c9b7aa' },
      })
        .png()
        .toBuffer();
  const preview = await renderBrowPreview(image);
  const comparison = await composeBrowComparison([
    { image, label: 'Natural' },
    { image, label: 'Soft Angled' },
  ]);
  if (process.env.BROW_RENDER_PREVIEW)
    writeFileSync(process.env.BROW_RENDER_PREVIEW, preview);
  if (process.env.BROW_RENDER_COMPARISON)
    writeFileSync(process.env.BROW_RENDER_COMPARISON, comparison);
  process.stdout.write(
    JSON.stringify(
      [preview, comparison].map((buffer) =>
        createHash('sha256').update(buffer).digest('hex')
      )
    )
  );
}
void main();
