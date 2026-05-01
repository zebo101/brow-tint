import { Suspense } from 'react';

import { Section } from '@/shared/types/blocks/landing';

import { BrowTintStudio as BrowTintStudioImpl } from './brow-tint/studio';
import type { BrowStyleItem } from './brow-tint/types';

interface BrowTintStudioBlockProps {
  section: Section;
  styles?: BrowStyleItem[];
}

/**
 * Section-level wrapper that lets the dynamic-page renderer mount the
 * BrowTintStudio inline as a regular block. The page entry injects the
 * available styles via `section.data.styles` so the studio gets its options
 * from the server query without needing a separate fetch.
 */
export function BrowTintStudio({ styles }: BrowTintStudioBlockProps) {
  if (!styles || styles.length === 0) {
    return null;
  }
  return (
    <Suspense>
      <BrowTintStudioImpl styles={styles} />
    </Suspense>
  );
}
