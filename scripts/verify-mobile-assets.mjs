// Public HTML regression check; run after deployment before PageSpeed retesting.
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'https://browlens.com';
const response = await fetch(origin, { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200);
const html = await response.text();
const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
      key.toLowerCase(),
      value.replaceAll('&amp;', '&'),
    ])
  );
const images = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => attrs(tag));
const hero = images.find((img) =>
  img.class?.split(' ').includes('brow-showcase__example-image')
);
assert.ok(hero, 'Server-rendered hero image');
assert.equal(hero.fetchpriority, 'high', 'LCP image is high priority');
assert.equal(hero.loading, 'eager', 'LCP image is not lazy');
assert.ok(
  hero.srcset?.includes('/_next/image?'),
  'LCP image has responsive optimized candidates'
);
assert.equal(hero.sizes, '(max-width: 760px) 216px, 288px');
const preload = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) => attrs(tag))
  .find(
    (link) =>
      link.rel === 'preload' &&
      link.as === 'image' &&
      link.imagesrcset === hero.srcset
  );
assert.equal(
  preload?.fetchpriority,
  'high',
  'Matching high-priority preload in server HTML'
);
const samples = images.filter((img) => img.sizes === '32px');
assert.equal(samples.length, 4, 'Four responsive sample thumbnails');
assert.ok(samples.every((img) => img.srcset?.includes('/_next/image?')));
const styles = images.filter((img) => img.sizes?.includes('28vw'));
assert.ok(styles.length > 0, 'Production style thumbnails are present');
assert.ok(styles.every((img) => img.srcset?.includes('/_next/image?')));
console.log(
  JSON.stringify(
    {
      origin,
      checkedAt: new Date().toISOString(),
      heroPriority: hero.fetchpriority,
      heroSizes: hero.sizes,
      highPriorityPreload: true,
      sampleThumbnails: samples.length,
      responsiveStyleThumbnails: styles.length,
    },
    null,
    2
  )
);
