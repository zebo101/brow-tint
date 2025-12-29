import sharp from 'sharp';

import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createHairstyle, getHairstyles } from '@/shared/models/hairstyle';
import { analyzeHairstyleWithAI } from '@/shared/services/hairstyle-analyzer';
import { getHairstyleStorageService } from '@/shared/services/hairstyle-storage';

const THUMBNAIL_SIZE = 150;

/**
 * POST /api/hairstyle/upload
 * Upload a single hairstyle image with AI analysis
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file || !category) {
      return respErr('File and category are required');
    }

    // Validate category
    const validCategories = ['men', 'women', 'boys', 'girls'];
    if (!validCategories.includes(category.toLowerCase())) {
      return respErr('Invalid category. Must be: men, women, boys, or girls');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return respErr('File must be an image');
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate thumbnail using Sharp
    const thumbnailBuffer = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toBuffer();

    // Upload original image to R2 (hairstyles bucket)
    const storageService = await getHairstyleStorageService();
    const originalKey = `${category}/${getUuid()}.png`;
    const originalResult = await storageService.uploadFile({
      body: buffer,
      key: originalKey,
      contentType: 'image/png',
    });

    if (!originalResult.success || !originalResult.url) {
      return respErr('Failed to upload original image');
    }

    // Upload thumbnail to R2
    const thumbnailKey = `${category}/thumb_${getUuid()}.png`;
    const thumbnailResult = await storageService.uploadFile({
      body: thumbnailBuffer,
      key: thumbnailKey,
      contentType: 'image/png',
    });

    if (!thumbnailResult.success || !thumbnailResult.url) {
      return respErr('Failed to upload thumbnail');
    }

    // Get existing hairstyles count for sequence number
    const existingHairstyles = await getHairstyles({
      category: category.toLowerCase(),
      status: 'active',
    });
    const sequence = existingHairstyles.length + 1;

    // Use AI to analyze the hairstyle
    const imageUrl = originalResult.url;
    if (!imageUrl) {
      return respErr('Failed to get image URL');
    }
    
    const aiResult = await analyzeHairstyleWithAI(imageUrl);

    // Save to database
    const hairstyle = await createHairstyle({
      id: getUuid(),
      category: category.toLowerCase(),
      sequence,
      name: aiResult.name,
      tags: JSON.stringify(aiResult.tags),
      imageUrl: originalResult.url,
      thumbnailUrl: thumbnailResult.url,
      status: 'active',
    });

    return respData({
      hairstyle: {
        id: hairstyle.id,
        category: hairstyle.category,
        sequence: hairstyle.sequence,
        name: hairstyle.name,
        tags: aiResult.tags,
        imageUrl: hairstyle.imageUrl,
        thumbnailUrl: hairstyle.thumbnailUrl,
      },
    });
  } catch (e) {
    console.error('Failed to upload hairstyle:', e);
    return respErr('Failed to upload hairstyle');
  }
}
