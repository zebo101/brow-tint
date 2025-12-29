import { respData, respErr } from '@/shared/lib/resp';
import { getHairstyles, getHairstyleCountByCategory } from '@/shared/models/hairstyle';

/**
 * GET /api/hairstyle/list
 * Get hairstyles list with optional filtering
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const status = (url.searchParams.get('status') as 'active' | 'inactive') || 'active';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

    // Get hairstyles
    const hairstyles = await getHairstyles({
      category,
      status,
      page,
      limit,
    });

    // Get category counts
    const categoryCounts = await getHairstyleCountByCategory(status);

    return respData({
      hairstyles: hairstyles.map((h) => ({
        id: h.id,
        category: h.category,
        sequence: h.sequence,
        name: h.name,
        tags: h.tags ? JSON.parse(h.tags) : [],
        imageUrl: h.imageUrl,
        thumbnailUrl: h.thumbnailUrl,
      })),
      categories: categoryCounts,
    });
  } catch (e) {
    console.error('Failed to get hairstyles:', e);
    return respErr('Failed to get hairstyles');
  }
}
