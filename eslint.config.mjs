import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.source/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'public/**',
      'src/config/db/migrations/**',
      '.contentlayer/**',
      'coverage/**',
      'dist/**',
      'build/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
