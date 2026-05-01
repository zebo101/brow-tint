import sharp from 'sharp';

import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createBrowTint, getBrowTints } from '@/shared/models/brow-tint';
import { analyzeBrowTintWithAI } from '@/shared/services/brow-tint-analyzer';
import { getBrowTintStorageService } from '@/shared/services/brow-tint-storage';

const THUMBNAIL_SIZE = 150;

/**
 * POST /api/brow-tint/upload
 * Upload a single brow tint image with AI analysis
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

    // Upload original image to R2 (brow tint bucket)
    const storageService = await getBrowTintStorageService();
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

    // Get existing brow tints count for sequence number
    const existingBrowTints = await getBrowTints({
      category: category.toLowerCase(),
      status: 'active',
    });
    const sequence = existingBrowTints.length + 1;

    // Use AI to analyze the brow tint style
    const imageUrl = originalResult.url;
    if (!imageUrl) {
      return respErr('Failed to get image URL');
    }

    const aiResult = await analyzeBrowTintWithAI(imageUrl);

    // Save to database
    const browTint = await createBrowTint({
      id: getUuid(),
      category: category.toLowerCase(),
      sequence,
      name: aiResult.name,
      tags: JSON.stringify(aiResult.tags),
      description: aiResult.description || null,
      prompt: aiResult.prompt || null,
      imageUrl: originalResult.url,
      thumbnailUrl: thumbnailResult.url,
      status: 'active',
    });

    return respData({
      browTint: {
        id: browTint.id,
        category: browTint.category,
        sequence: browTint.sequence,
        name: browTint.name,
        tags: aiResult.tags,
        description: aiResult.description,
        prompt: aiResult.prompt,
        imageUrl: browTint.imageUrl,
        thumbnailUrl: browTint.thumbnailUrl,
      },
    });
  } catch (e) {
    console.error('Failed to upload brow tint:', e);
    return respErr('Failed to upload brow tint');
  }
}
