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
    '/imgs/suitable/1.jpg',
    '/imgs/suitable/2.jpg',
    '/imgs/suitable/3.jpg',
    '/imgs/suitable/4.jpg',
  ],
  unsuitablePhotos: [
    '/imgs/unsuitable/1.jpg',
    '/imgs/unsuitable/2.jpg',
    '/imgs/unsuitable/3.jpg',
    '/imgs/unsuitable/4.jpg',
  ],
  storageKey: 'hidePhotoGuidelines',
};
