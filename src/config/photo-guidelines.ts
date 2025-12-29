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
  suitablePhotos: [
    '/imgs/suitable/1.png',
    '/imgs/suitable/2.png',
    '/imgs/suitable/3.png',
    '/imgs/suitable/4.png',
  ],
  unsuitablePhotos: [
    '/imgs/unsuitable/1.png',
    '/imgs/unsuitable/2.png',
    '/imgs/unsuitable/3.png',
    '/imgs/unsuitable/4.png',
  ],
  storageKey: 'hidePhotoGuidelines',
};
