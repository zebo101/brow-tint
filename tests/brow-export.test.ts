import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';

import {
  assertBrowExportAccess,
  serializeBrowTaskForClient,
} from '../src/shared/lib/brow-export';
import { createBrowExportHandlers } from '../src/shared/lib/brow-export-handlers';
import {
  composeBrowComparison,
  normalizeBrowExport,
  renderBrowPreview,
} from '../src/shared/services/brow-export-image';

const paid = { canExport: true, canCompare: false };
const premium = { canExport: true, canCompare: true };
const free = { canExport: false, canCompare: false };
const task = (id = 'a', source = 'https://uploads.example/photo.png') => ({
  id,
  userId: 'owner',
  status: 'success',
  mediaType: 'image',
  scene: 'image-to-image',
  costCredits: 2,
  options: JSON.stringify({
    __browExport: { styleId: id, styleName: `Style ${id}`, source },
    image_input: [source],
  }),
  taskInfo: JSON.stringify({
    images: [{ imageUrl: 'https://provider.example/secret.png' }],
  }),
  taskResult: JSON.stringify({ output: 'https://provider.example/secret.png' }),
  taskId: 'provider-secret',
  prompt: 'private',
});

test('watermark stays in the lower corner and clean downloads preserve the portrait', async () => {
  const original = await sharp({
    create: { width: 480, height: 640, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  const preview = await renderBrowPreview(original);
  const body = await sharp(preview)
    .extract({ left: 0, top: 0, width: 480, height: 575 })
    .raw()
    .toBuffer();
  assert.ok(
    body.every((value) => value >= 250),
    'Watermark must leave the face and brow region untouched'
  );
  const label = await sharp(preview)
    .extract({ left: 316, top: 588, width: 148, height: 36 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(
    label.filter((value) => value < 120).length > 200,
    'Brand lettering must be visible, not blank'
  );
  const clean = await normalizeBrowExport(original);
  assert.deepEqual(
    await sharp(clean).raw().toBuffer(),
    await sharp(original).raw().toBuffer()
  );
  for (const [width, height] of [
    [120, 160],
    [640, 160],
    [1, 1],
  ]) {
    const tiny = await sharp({
      create: { width, height, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer();
    const metadata = await sharp(await renderBrowPreview(tiny)).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
  }
});

test('export requires paid entitlement and owned successful eyebrow tasks', () => {
  assert.throws(
    () => assertBrowExportAccess([task()], 'owner', free),
    /paid_export_required/
  );
  assert.throws(
    () => assertBrowExportAccess([task()], 'stranger', paid),
    /result_not_found/
  );
  for (const change of [
    { status: 'processing' },
    { mediaType: 'video' },
    { scene: 'text-to-image' },
    { options: '{}' },
  ]) {
    assert.throws(
      () => assertBrowExportAccess([{ ...task(), ...change }], 'owner', paid),
      /result_not_ready/
    );
  }
  assert.doesNotThrow(() => assertBrowExportAccess([task()], 'owner', paid));
});

test('comparison requires Premium, distinct styles and 2–4 real results of one photo', () => {
  assert.throws(
    () => assertBrowExportAccess([task(), task('b')], 'owner', paid),
    /premium_required/
  );
  assert.throws(
    () => assertBrowExportAccess([task(), task()], 'owner', premium),
    /invalid_selection/
  );
  assert.throws(
    () =>
      assertBrowExportAccess(
        [task(), task('b', 'https://uploads.example/other.png')],
        'owner',
        premium
      ),
    /same_photo_required/
  );
  assert.throws(
    () =>
      assertBrowExportAccess(
        ['a', 'b', 'c', 'd', 'e'].map((id) => task(id)),
        'owner',
        premium
      ),
    /invalid_selection/
  );
  assert.doesNotThrow(() =>
    assertBrowExportAccess([task(), task('b')], 'owner', premium)
  );
  assert.throws(
    () =>
      assertBrowExportAccess(
        [task(), { ...task(), id: 'repeat' }],
        'owner',
        premium
      ),
    /different_styles_required/
  );
});

test('HTTP export endpoints reject unauthenticated/free/foreign/pending requests before loading image bytes', async () => {
  let fetched = 0;
  let currentUser: { id: string } | null = null;
  let entitlement = free;
  let saved = task();
  const handlers = createBrowExportHandlers({
    user: async () => currentUser,
    entitlements: async () => entitlement,
    task: async () => saved,
    image: async () => {
      fetched++;
      throw new Error('must not fetch');
    },
  });
  const request = (ids = ['a']) =>
    new Request('https://browlens.com/api/brow/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: ids }),
    });
  assert.equal((await handlers.export(request())).status, 401);
  currentUser = { id: 'owner' };
  assert.equal((await handlers.export(request())).status, 403);
  assert.equal(
    (
      await handlers.local(
        new Request('https://browlens.com/api/brow/export/local', {
          method: 'POST',
          body: 'not-even-an-image',
        })
      )
    ).status,
    403
  );
  entitlement = paid;
  saved = { ...task(), userId: 'another' };
  assert.equal((await handlers.export(request())).status, 404);
  assert.equal(
    (
      await handlers.preview(
        new Request('https://browlens.com/api/brow/preview?taskId=a')
      )
    ).status,
    404
  );
  saved = { ...task(), status: 'processing' };
  assert.equal((await handlers.export(request())).status, 409);
  saved = task();
  assert.equal((await handlers.export(request(['a', 'b']))).status, 403);
  assert.equal((await handlers.export(request(['a', 'a']))).status, 400);
  assert.equal(fetched, 0);
});

test('owned free previews remain available, while Premium comparison validates then renders both tasks', async () => {
  const image = await sharp({
    create: { width: 120, height: 160, channels: 3, background: '#639' },
  })
    .png()
    .toBuffer();
  let entitlements = free;
  const handlers = createBrowExportHandlers({
    user: async () => ({ id: 'owner' }),
    entitlements: async () => entitlements,
    task: async (id) => task(id),
    image: async () => image,
  });
  const preview = await handlers.preview(
    new Request('https://browlens.com/api/brow/preview?taskId=a')
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('content-type'), 'image/jpeg');
  entitlements = premium;
  const request = (body: string) =>
    new Request('https://browlens.com/api/brow/export', {
      method: 'POST',
      body,
    });
  const comparison = await handlers.export(
    request(JSON.stringify({ taskIds: ['a', 'b'] }))
  );
  assert.equal(comparison.status, 200);
  assert.match(
    comparison.headers.get('content-disposition')!,
    /style-comparison/
  );
  assert.equal(
    (await sharp(Buffer.from(await comparison.arrayBuffer())).metadata()).width,
    2448
  );
  assert.equal((await handlers.export(request('invalid json'))).status, 400);
  assert.equal((await handlers.export(request('x'.repeat(2050)))).status, 413);
});

test('HTTP single export and local export produce clean PNGs only while entitlement is active', async () => {
  const image = await sharp({
    create: { width: 100, height: 80, channels: 3, background: '#f00' },
  })
    .jpeg()
    .toBuffer();
  let entitlement = paid;
  const handlers = createBrowExportHandlers({
    user: async () => ({ id: 'owner' }),
    entitlements: async () => entitlement,
    task: async () => task(),
    image: async () => image,
  });
  const request = () =>
    new Request('https://browlens.com/api/brow/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: ['a'] }),
    });
  const exported = await handlers.export(request());
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('content-type'), 'image/png');
  assert.match(exported.headers.get('cache-control')!, /no-store/);
  assert.match(exported.headers.get('content-disposition')!, /attachment/);
  assert.equal(
    (await sharp(Buffer.from(await exported.arrayBuffer())).metadata()).width,
    100
  );
  const form = new FormData();
  form.append(
    'image',
    new Blob([new Uint8Array(image)], { type: 'image/jpeg' }),
    'image.jpg'
  );
  assert.equal(
    (
      await handlers.local(
        new Request('https://browlens.com/api/brow/export/local', {
          method: 'POST',
          body: form,
        })
      )
    ).status,
    200
  );
  entitlement = free;
  assert.equal((await handlers.export(request())).status, 403);
});

test('client serialization never contains provider results, inputs, or provider task ID', () => {
  for (const entitlements of [free, paid, premium]) {
    const serialized = serializeBrowTaskForClient(task(), entitlements);
    const json = JSON.stringify(serialized);
    assert.doesNotMatch(
      json,
      /provider\.example|uploads\.example|provider-secret|private/
    );
    assert.match(json, /\/api\/brow\/preview/);
    assert.equal(serialized.canExport, entitlements.canExport);
  }
  const legacy = serializeBrowTaskForClient({ ...task(), options: '{}' }, free);
  assert.doesNotMatch(JSON.stringify(legacy), /provider\.example/);
  for (const scene of ['text-to-image', null]) {
    assert.doesNotMatch(
      JSON.stringify(serializeBrowTaskForClient({ ...task(), scene }, free)),
      /provider\.example/
    );
  }
});

test('preview is limited to 640 pixels and comparison preserves real images in labeled HD panels', async () => {
  const red = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: '#f00' },
  })
    .png()
    .toBuffer();
  const blue = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: '#00f' },
  })
    .png()
    .toBuffer();
  const preview = await renderBrowPreview(red);
  const previewMeta = await sharp(preview).metadata();
  assert.ok(Math.max(previewMeta.width!, previewMeta.height!) <= 640);
  const output = await composeBrowComparison([
    { image: red, label: 'Natural' },
    { image: blue, label: 'Straight & lifted' },
  ]);
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 2448);
  assert.equal(meta.height, 1756);
  const pixel = async (left: number) => [
    ...(await sharp(output)
      .extract({ left, top: 500, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ];
  assert.deepEqual(await pixel(500), [255, 0, 0]);
  assert.deepEqual(await pixel(1700), [0, 0, 255]);
  await assert.rejects(
    composeBrowComparison([{ image: red, label: 'one' }]),
    /invalid_selection/
  );
  const four = await composeBrowComparison(
    [red, blue, red, blue].map((image, index) => ({
      image,
      label: `Style ${index + 1}`,
    }))
  );
  const fourMeta = await sharp(four).metadata();
  assert.equal(fourMeta.width, 2448);
  assert.equal(fourMeta.height, 3404);
});
