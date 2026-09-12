import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS } from 'hpsetup/src/constants.js';
import { findPackageDir, hasRealArtifacts } from 'hpsetup/src/discover.js';
import { downloadFromProxy } from 'hpsetup/src/download.js';

// hpsetup's CLI upgrades packages to @latest even after a frozen install.
// Use only the artifact downloader from the pinned hpsetup version so CI keeps
// the exact component versions tested locally and recorded in pnpm-lock.yaml.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8')
);
const product = PRODUCTS.react;
const expectedVersion = manifest.dependencies[product.packageName];
assert.match(
  expectedVersion,
  /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/,
  'Pin HeroUI Pro to an exact version'
);

const packageDir = findPackageDir(product.packageName, root);
assert.ok(
  packageDir,
  'Run pnpm install --frozen-lockfile --ignore-scripts first'
);
const installedVersion = () =>
  JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'))
    .version;
assert.equal(
  installedVersion(),
  expectedVersion,
  'HeroUI Pro differs from the project version'
);

if (!hasRealArtifacts(packageDir, product.artifactsDir)) {
  const key = process.env.HEROUI_KEY?.trim();
  assert.ok(key && /^hp_[0-9a-f]+$/.test(key), 'Missing or invalid HEROUI_KEY');
  await downloadFromProxy(
    product,
    expectedVersion,
    packageDir,
    key,
    false,
    Boolean(process.env.CI)
  );
}

assert.equal(
  installedVersion(),
  expectedVersion,
  'Downloaded HeroUI Pro version does not match'
);
assert.ok(
  hasRealArtifacts(packageDir, product.artifactsDir),
  'HeroUI Pro artifacts are missing'
);
console.log(
  `HeroUI Pro ${expectedVersion} ready; project dependencies unchanged.`
);
