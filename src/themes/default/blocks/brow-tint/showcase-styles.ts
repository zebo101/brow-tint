import type { BrowStyleItem } from './types';

/** Preserve catalog order within trending, popular, and remaining groups. */
export function getShowcaseStyles(
  styles: BrowStyleItem[],
  limit: number
): BrowStyleItem[] {
  const ranked = [
    ...styles.filter((style) => style.trending),
    ...styles.filter((style) => style.popular && !style.trending),
    ...styles.filter((style) => !style.popular && !style.trending),
  ];
  return ranked.slice(0, Math.max(0, limit));
}
