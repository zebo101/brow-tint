// One-shot converter: turn /public/imgs/{suitable,unsuitable}/*.jpg into
// .webp at quality 80 and ~600px wide (modal renders them at ~200px max).
// Run: node scripts/convert-guideline-photos.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'imgs');
const DIRS = ['suitable', 'unsuitable'];

let totalIn = 0;
let totalOut = 0;

for (const dir of DIRS) {
  const dirPath = path.join(ROOT, dir);
  const files = await fs.readdir(dirPath);
  for (const f of files) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const inPath = path.join(dirPath, f);
    const outPath = path.join(dirPath, f.replace(/\.(jpe?g|png)$/i, '.webp'));
    const inStat = await fs.stat(inPath);
    await sharp(inPath)
      .resize({ width: 600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);
    const outStat = await fs.stat(outPath);
    totalIn += inStat.size;
    totalOut += outStat.size;
    console.log(
      `${dir}/${f}: ${(inStat.size / 1024).toFixed(0)}KB -> ${(outStat.size / 1024).toFixed(0)}KB`
    );
    // Drop the jpg now that the webp exists
    await fs.unlink(inPath);
  }
}

console.log(
  `\nTotal: ${(totalIn / 1024).toFixed(0)}KB -> ${(totalOut / 1024).toFixed(0)}KB ` +
    `(${((1 - totalOut / totalIn) * 100).toFixed(0)}% smaller)`
);
