import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHairstylePrompt } from './img-prompt';

test('buildHairstylePrompt makes the reference image primary for image-to-image when styledPrompt is provided', () => {
  const styledPrompt =
    'Short textured crop, approximately 3 cm on top, messy finger-styled texture, tapered temples, matte finish.';
  const out = buildHairstylePrompt(
    'Short Textured Crop',
    ['short', 'textured'],
    '',
    1,
    styledPrompt
  );

  assert.ok(
    out.includes(styledPrompt),
    'should embed the engineered prompt verbatim'
  );
  assert.ok(
    out.includes('primary visual authority'),
    'should explicitly make the reference image primary'
  );
  assert.ok(
    out.includes('Match the hairstyle in the reference image as closely as possible'),
    'should strongly instruct the model to follow the reference hairstyle'
  );
  assert.ok(
    /Ignore any cutout edges, halos, transparent areas/.test(out),
    'should include the artifact-ignore instruction'
  );
  assert.ok(
    out.includes('Image 1 is the person') &&
      out.includes('Image 2 is a hairstyle reference'),
    'should still assign image roles'
  );
  assert.ok(
    !out.includes('Use the image ONLY to disambiguate shape details'),
    'should not demote the reference image to a minor hint'
  );
});

test('buildHairstylePrompt still prioritizes the reference image when no styledPrompt is given', () => {
  const out = buildHairstylePrompt('Short Textured Crop', ['short'], '', 1);

  assert.ok(
    out.includes('Use the hairstyle reference image as the primary source of truth'),
    'should make the reference image primary even without a styledPrompt'
  );
  assert.ok(
    out.includes('Match the hairstyle in the reference image as closely as possible'),
    'should still strongly instruct reference following'
  );
  assert.ok(!out.includes('authoritative description'));
});

test('buildHairstylePrompt in text-to-image mode uses styledPrompt when available', () => {
  const styledPrompt =
    'Long wavy layered hair, ~30 cm, soft curtain bangs, natural brown, suitable for oval faces.';
  const out = buildHairstylePrompt(
    'Long Wavy Layers',
    ['long', 'wavy'],
    '',
    0,
    styledPrompt
  );

  assert.ok(out.includes(styledPrompt));
  assert.ok(out.includes('photorealistic portrait'));
  // No reference-image instructions should appear since no user photo
  assert.ok(!out.includes('Image 1 is the person'));
  assert.ok(!out.includes('Ignore any cutout edges'));
});

test('buildHairstylePrompt in text-to-image mode without styledPrompt uses the legacy generator line', () => {
  const out = buildHairstylePrompt('Long Wavy Layers', [], '', 0);
  assert.ok(
    out.includes('Generate a person with a Long Wavy Layers hairstyle')
  );
});
