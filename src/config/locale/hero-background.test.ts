import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const locales = ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt'];
const expectedHeroBackgroundSrc = '/imgs/bg/hero-1.jpg';

test('index hero background uses the jpg asset in every locale', () => {
  for (const locale of locales) {
    const messagePath = join(
      process.cwd(),
      'src',
      'config',
      'locale',
      'messages',
      locale,
      'pages',
      'index.json'
    );
    const message = JSON.parse(readFileSync(messagePath, 'utf8'));

    assert.equal(
      message.page.sections.hero.background_image.src,
      expectedHeroBackgroundSrc,
      `${locale} index hero background should use hero-1.jpg`
    );
  }

  assert.equal(
    existsSync(join(process.cwd(), 'public', 'imgs', 'bg', 'hero-1.jpg')),
    true,
    'public hero-1.jpg asset should exist'
  );
});
