import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHairstylePrompt } from './img-prompt';

test('buildHairstylePrompt embeds the engineered styledPrompt and artifact-ignore instruction when provided', () => {
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
    out.includes('authoritative description'),
    'should mark the engineered prompt as authoritative'
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
});

test('buildHairstylePrompt falls back to name+tags wording when no styledPrompt is given', () => {
  const out = buildHairstylePrompt('Short Textured Crop', ['short'], '', 1);

  assert.ok(
    out.includes(
      'Change ONLY the hair of the person to a Short Textured Crop style'
    ),
    'should use the legacy name-based wording'
  );
  assert.ok(!out.includes('authoritative description'));
  assert.ok(!out.includes('Ignore any cutout edges'));
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
