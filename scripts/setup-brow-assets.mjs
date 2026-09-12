import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sdk = path.dirname(require.resolve('@mediapipe/tasks-vision'));
const version = '1.0.1';
const modelSha256 =
  '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
const destination = path.resolve('public/models/brow', version);
await mkdir(path.join(destination, 'wasm'), { recursive: true });
await copyFile(
  path.join(sdk, 'vision_bundle.js'),
  path.join(destination, 'vision_bundle.js')
);
for (const filename of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  await copyFile(
    path.join(sdk, 'wasm', filename),
    path.join(destination, 'wasm', filename)
  );
}
const modelSource =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelPath = path.join(destination, 'face_landmarker.task');
let model;
try {
  model = await readFile(modelPath);
} catch {
  const response = await fetch(modelSource, {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
  if (model.length < 1000000) throw new Error('Invalid model asset');
}
if (createHash('sha256').update(model).digest('hex') !== modelSha256)
  throw new Error(
    'Face model checksum mismatch; restore the official v1 asset.'
  );
await writeFile(modelPath, model);
await writeFile(
  path.join(destination, 'NOTICE.md'),
  `# Local brow detection assets\n\nMediaPipe Tasks Vision ${version}, Apache-2.0.\nhttps://github.com/google-ai-edge/mediapipe/blob/master/LICENSE\n\nOfficial Face Landmarker float16 model, version 1:\n${modelSource}\n\nModel SHA-256: ${createHash('sha256').update(model).digest('hex')}\n\nRun pnpm exec node scripts/setup-brow-assets.mjs to restore these assets. Photos are processed in the browser; no photo is sent to these model sources.\n`
);
console.log(
  `Brow SDK ${version} and model ready (${model.length} model bytes).`
);
