import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getImageModelSelectValue,
  getPreferredImageModel,
  resolveImageModelSelection,
} from './image-models';

test('getPreferredImageModel prefers GPT Image 2 for Kie image-to-image', () => {
  assert.equal(
    getPreferredImageModel({
      activeTab: 'image-to-image',
      provider: 'kie',
    }),
    'gpt-image-2-image-to-image'
  );
});

test('getPreferredImageModel prefers GPT Image 2 for Kie text-to-image', () => {
  assert.equal(
    getPreferredImageModel({
      activeTab: 'text-to-image',
      provider: 'kie',
    }),
    'gpt-image-2-text-to-image'
  );
});

test('getPreferredImageModel falls back to the first available non-Kie model', () => {
  assert.equal(
    getPreferredImageModel({
      activeTab: 'image-to-image',
      provider: 'replicate',
    }),
    'google/nano-banana-pro'
  );
});

test('getImageModelSelectValue collapses GPT Image 2 variants into one select value', () => {
  assert.equal(
    getImageModelSelectValue('gpt-image-2-image-to-image'),
    'gpt-image-2'
  );
  assert.equal(
    getImageModelSelectValue('gpt-image-2-text-to-image'),
    'gpt-image-2'
  );
  assert.equal(getImageModelSelectValue('nano-banana-pro'), 'nano-banana-pro');
});

test('resolveImageModelSelection maps the GPT Image 2 option to the active tab variant', () => {
  assert.equal(
    resolveImageModelSelection({
      activeTab: 'image-to-image',
      value: 'gpt-image-2',
    }),
    'gpt-image-2-image-to-image'
  );
  assert.equal(
    resolveImageModelSelection({
      activeTab: 'text-to-image',
      value: 'gpt-image-2',
    }),
    'gpt-image-2-text-to-image'
  );
  assert.equal(
    resolveImageModelSelection({
      activeTab: 'image-to-image',
      value: 'nano-banana-pro',
    }),
    'nano-banana-pro'
  );
});
