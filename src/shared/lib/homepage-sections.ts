// Temporarily disabled while the site is in review; these sections contain
// trust metrics and testimonial copy that should not be shown until verified.
const DISABLED_HOMEPAGE_SECTIONS = new Set([
  'stats',
  'testimonials',
  'subscribe',
]);

export function getHomepageShownSections(sections: string[]) {
  return sections.filter((section) => !DISABLED_HOMEPAGE_SECTIONS.has(section));
}
