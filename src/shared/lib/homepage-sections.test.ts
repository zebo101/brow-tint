import assert from 'node:assert/strict';
import test from 'node:test';

import { getHomepageShownSections } from './homepage-sections';

test('filters review-sensitive homepage sections during approval', () => {
  const sections = [
    'hero',
    'studio',
    'features',
    'stats',
    'testimonials',
    'subscribe',
    'faq',
  ];

  assert.deepEqual(getHomepageShownSections(sections), [
    'hero',
    'studio',
    'features',
    'faq',
  ]);
});
