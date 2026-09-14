// Check rendered navigation and share cards locally or after deployment.
// node scripts/verify-social-seo.mjs https://browlens.com
import assert from 'node:assert/strict';
import sharp from 'sharp';

const origin = process.argv[2] || 'http://127.0.0.1:3121';
const locales = ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt'];
const imagePath = '/imgs/og/browlens-home-20260914.jpg';
const results = [];
async function read(path) {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'user-agent': 'Googlebot' },
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(response.status, 200, path);
  return response;
}
function metadata(html) {
  return Object.fromEntries(
    [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => {
      const attrs = Object.fromEntries(
        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])
      );
      return [attrs.property || attrs.name, attrs.content];
    })
  );
}
for (const locale of locales) {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const path = prefix || '/';
  const html = await (await read(path)).text();
  const meta = metadata(html);
  assert.equal(meta['twitter:site'], undefined, `${path}: invalid X site`);
  assert.equal(meta['og:image'], `https://browlens.com${imagePath}`);
  assert.equal(meta['twitter:image'], meta['og:image']);
  assert.equal(meta['og:image:width'], '1200');
  assert.equal(meta['og:image:height'], '630');
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
  assert.ok(header, `${path}: header`);
  const urls = [...header.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(
    (m) => m[1]
  );
  const blog = urls.indexOf(`${prefix}/blog`);
  assert.ok(blog >= 0, `${path}: blog link`);
  assert.equal(
    urls[blog + 1],
    `${prefix}/filter`,
    `${path}: Filter after Blog`
  );
  assert.equal(
    urls[blog + 2],
    `${prefix}/pricing`,
    `${path}: Pricing after Filter`
  );
  results.push({ path, filterNavigation: true, shareImage: meta['og:image'] });
}
const article = metadata(
  await (await read('/blog/eyebrow-mapping-guide')).text()
);
assert.match(article['og:image'], /\/imgs\/cases\//);
assert.equal(article['twitter:image'], article['og:image']);
const response = await read(imagePath);
assert.match(response.headers.get('content-type'), /image\/jpeg/);
const bytes = Buffer.from(await response.arrayBuffer());
const image = await sharp(bytes).metadata();
assert.equal(image.width, 1200);
assert.equal(image.height, 630);
console.log(
  JSON.stringify(
    {
      origin,
      checkedAt: new Date().toISOString(),
      homepages: results.length,
      articleImagePreserved: true,
      image: { width: image.width, height: image.height, bytes: bytes.length },
      results,
    },
    null,
    2
  )
);
