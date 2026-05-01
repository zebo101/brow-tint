import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrowStylePrompt, buildBrowTintPrompt } from './img-prompt';

test('buildBrowTintPrompt makes the reference image primary for image-to-image when styledPrompt is provided', () => {
  const styledPrompt =
    'Short textured crop, approximately 3 cm on top, messy finger-styled texture, tapered temples, matte finish.';
  const out = buildBrowTintPrompt(
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
    out.includes('Match the brow tint style in the reference image as closely as possible'),
    'should strongly instruct the model to follow the reference brow tint style'
  );
  assert.ok(
    /Ignore any cutout edges, halos, transparent areas/.test(out),
    'should include the artifact-ignore instruction'
  );
  assert.ok(
    out.includes('Image 1 is the person') &&
      out.includes('Image 2 is a brow tint reference'),
    'should still assign image roles'
  );
  assert.ok(
    !out.includes('Use the image ONLY to disambiguate shape details'),
    'should not demote the reference image to a minor hint'
  );
});

test('buildBrowTintPrompt still prioritizes the reference image when no styledPrompt is given', () => {
  const out = buildBrowTintPrompt('Short Textured Crop', ['short'], '', 1);

  assert.ok(
    out.includes('Use the brow tint reference image as the primary source of truth'),
    'should make the reference image primary even without a styledPrompt'
  );
  assert.ok(
    out.includes('Match the brow tint style in the reference image as closely as possible'),
    'should still strongly instruct reference following'
  );
  assert.ok(!out.includes('authoritative description'));
});

test('buildBrowTintPrompt in text-to-image mode uses styledPrompt when available', () => {
  const styledPrompt =
    'Long wavy layered hair, ~30 cm, soft curtain bangs, natural brown, suitable for oval faces.';
  const out = buildBrowTintPrompt(
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

test('buildBrowTintPrompt in text-to-image mode without styledPrompt uses the legacy generator line', () => {
  const out = buildBrowTintPrompt('Long Wavy Layers', [], '', 0);
  assert.ok(
    out.includes('Generate a person with a Long Wavy Layers brow tint style')
  );
});

test('buildBrowStylePrompt includes shape shade and intensity', () => {
  const out = buildBrowStylePrompt({
    name: 'Soft Taupe Arch',
    shade: 'taupe',
    shape: 'soft arch',
    intensity: 'medium',
    styledPrompt: 'Softly tinted brows with balanced density.',
    subjectImageCount: 1,
  });

  assert.ok(out.includes('taupe'));
  assert.ok(out.includes('soft arch'));
  assert.ok(out.includes('medium'));
  assert.ok(out.includes("Image 1 is the user's portrait photo."));
});

test('buildBrowStylePrompt appends styledPrompt verbatim', () => {
  const styledPrompt =
    'Precisely feathered brows with a soft taupe tint and airy tail finish.';
  const out = buildBrowStylePrompt({
    name: 'Feathered Taupe',
    shade: 'taupe',
    shape: 'feathered',
    intensity: 'sheer',
    styledPrompt,
    subjectImageCount: 1,
  });

  assert.ok(
    out.includes(
      `Supporting style description from the selected brow style: ${styledPrompt}`
    )
  );
});

test('buildBrowStylePrompt avoids forbidden head-hair vocabulary', () => {
  const out = buildBrowStylePrompt({
    name: 'Rich Espresso Brow',
    shade: 'espresso',
    shape: 'lifted',
    intensity: 'rich',
    styledPrompt: 'Defined brows with a rich espresso tint and clean arch.',
    subjectImageCount: 1,
  });

  assert.equal(
    /\b(hair|hairline|fringe|temples|sideburns|parting)\b/i.test(out),
    false
  );
});
