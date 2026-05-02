/**
 * Photo Guidelines Configuration
 * Example images for the photo upload guidelines modal
 */

export interface PhotoGuidelinesConfig {
  /** Paths to suitable example photos */
  suitablePhotos: string[];
  /** Paths to unsuitable example photos */
  unsuitablePhotos: string[];
  /** localStorage key for "don't show again" preference */
  storageKey: string;
}

export const photoGuidelinesConfig: PhotoGuidelinesConfig = {
  // Resized to 600×600 WebP from the original 170–280 KB JPGs — total
  // payload dropped from 1.3 MB to ~176 KB (-87%) without any visual
  // difference at the modal's max ~200 px display size.
  suitablePhotos: [
    '/imgs/suitable/1.webp',
    '/imgs/suitable/2.webp',
    '/imgs/suitable/3.webp',
    '/imgs/suitable/4.webp',
  ],
  unsuitablePhotos: [
    '/imgs/unsuitable/1.webp',
    '/imgs/unsuitable/2.webp',
    '/imgs/unsuitable/3.webp',
    '/imgs/unsuitable/4.webp',
  ],
  storageKey: 'hidePhotoGuidelines',
};
