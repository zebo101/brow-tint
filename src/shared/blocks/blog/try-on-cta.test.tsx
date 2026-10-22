import assert from 'node:assert/strict';
import test from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import { locales } from '@/config/locale';

import { TryOnCta } from './try-on-cta';

test('the default MDX CTA works without a title or text and localizes both links in all locales', () => {
  for (const locale of locales) {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
        <TryOnCta />
      </NextIntlClientProvider>
    );
    const prefix = locale === 'en' ? '' : `/${locale}`;
    assert.ok(html.includes(`href="${prefix}/filter"`));
    assert.ok(html.includes(`href="${prefix}/eyebrow-shape-for-face-shape"`));
    assert.match(html, /Try the free eyebrow filter/);
    assert.match(html, /Find your face-shape brow match/);
    assert.doesNotMatch(html, /<h2|<p[ >]/);
  }
});

test('the MDX CTA accepts plain-text copy and custom destinations', () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="de" messages={{}} timeZone="UTC">
      <TryOnCta
        title="Deine Brauen & dein Stil"
        text="Vorschau <b>ohne</b> Änderungen."
        primaryHref="/filter?style=natural#brow-app"
        primaryLabel="Jetzt testen"
        secondaryHref="/blog/eyebrow-mapping-guide"
        secondaryLabel="Anleitung lesen"
      />
    </NextIntlClientProvider>
  );

  assert.match(html, /<h2[^>]*>Deine Brauen &amp; dein Stil<\/h2>/);
  assert.match(html, /Vorschau &lt;b&gt;ohne&lt;\/b&gt; Änderungen\./);
  assert.ok(html.includes('href="/de/filter?style=natural#brow-app"'));
  assert.ok(html.includes('href="/de/blog/eyebrow-mapping-guide"'));
  assert.match(html, /Jetzt testen/);
  assert.match(html, /Anleitung lesen/);
  assert.doesNotMatch(html, /<b>|Try the free eyebrow filter/);
});
