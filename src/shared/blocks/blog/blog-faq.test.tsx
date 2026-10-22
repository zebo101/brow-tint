import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { BlogFaq } from './blog-faq';

const scriptPattern =
  /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

test('blog FAQ renders nothing when absent or empty', () => {
  assert.equal(renderToStaticMarkup(<BlogFaq />), '');
  assert.equal(renderToStaticMarkup(<BlogFaq faq={[]} title="No FAQ" />), '');
});

test('blog FAQ renders a heading and every plain-text answer on the server with one matching schema', () => {
  const faq = [
    { question: 'Can I compare looks?', answer: 'Yes, compare the previews.' },
    {
      question: '眉の形は？ & <b>tips</b>',
      answer: 'Keep **your** shape.\nNo </script><script>alert(1)</script>.',
    },
  ];
  const html = renderToStaticMarkup(<BlogFaq faq={faq} />);
  const scripts = [...html.matchAll(scriptPattern)];
  assert.equal(scripts.length, 1);
  const schema = JSON.parse(scripts[0][1]);
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, faq.length);

  const visibleHtml = html.replace(scriptPattern, '');
  assert.match(visibleHtml, /<h2[^>]*>Frequently Asked Questions<\/h2>/);
  assert.equal((visibleHtml.match(/<details\b/g) || []).length, faq.length);
  faq.forEach(({ question, answer }, index) => {
    assert.ok(
      visibleHtml.includes(renderToStaticMarkup(<span>{question}</span>))
    );
    assert.ok(
      visibleHtml.includes(
        renderToStaticMarkup(<p className="text-base">{answer}</p>)
      )
    );
    assert.equal(schema.mainEntity[index].name, question);
    assert.equal(schema.mainEntity[index].acceptedAnswer.text, answer);
  });
  assert.doesNotMatch(visibleHtml, /<script|<b>|<strong>/);
});

test('blog FAQ accepts a localized plain-text heading', () => {
  const html = renderToStaticMarkup(
    <BlogFaq
      faq={[{ question: 'Question', answer: 'Answer' }]}
      title="Häufig gestellte Fragen"
    />
  );
  assert.match(html, /<h2[^>]*>Häufig gestellte Fragen<\/h2>/);
  assert.doesNotMatch(html, /Frequently Asked Questions/);
});
