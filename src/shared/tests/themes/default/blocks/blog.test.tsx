import assert from 'node:assert/strict';
import test from 'node:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import blogMessages from '@/config/locale/messages/en/pages/blog.json';
import type { Post } from '@/shared/types/blocks/blog';
import { Blog } from '@/themes/default/blocks/blog';

function renderPostCard(post: Post) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      messages={{ pages: { blog: blogMessages } }}
      timeZone="UTC"
      onError={(error) => {
        throw error;
      }}
    >
      <Blog
        section={{ title: 'Guides' }}
        categories={[]}
        currentCategory={{}}
        posts={[post]}
      />
    </NextIntlClientProvider>
  );
}

const post = {
  title: 'Eyebrow mapping guide',
  image: '/imgs/cases/2.jpg',
  url: '/blog/eyebrow-mapping-guide',
};

test('blog list cards use descriptive cover alt text when provided', () => {
  const html = renderPostCard({
    ...post,
    image_alt: 'A portrait with brow head, arch, and tail marked',
  });
  assert.match(
    html,
    /<img[^>]*alt="A portrait with brow head, arch, and tail marked"/
  );
});

test('blog list cards retain their title fallback without image_alt', () => {
  const html = renderPostCard(post);
  assert.match(html, /<img[^>]*alt="Eyebrow mapping guide"/);
  assert.equal(renderPostCard({ ...post, image_alt: undefined }), html);
});
