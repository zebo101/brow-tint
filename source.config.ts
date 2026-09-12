import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export const pages = defineDocs({
  dir: 'content/pages',
});

export const posts = defineDocs({
  // Public guide collection: three current guides, each translated into eight languages.
  // Unmodified originals are backed up in docs/archives/tintbrow-articles-2026-09-12.
  dir: 'content/posts',
});

export const logs = defineDocs({
  // Previous release notes stay archived in content/logs.
  dir: 'content/browlens-logs',
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      // Use defaultLanguage for unknown language codes
      defaultLanguage: 'plaintext',
    },
  },
});
