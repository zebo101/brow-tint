import { respErr } from '@/shared/lib/resp';
import { getHairstyles, getHairstyleCountByCategory } from '@/shared/models/hairstyle';

// Cache the response for 1 hour - hairstyle data doesn't change frequently
export const revalidate = 3600;

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

    // Create response with cache headers
    const responseData = {
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
    };

    return new Response(JSON.stringify({ code: 0, data: responseData }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    console.error('Failed to get hairstyles:', e);
    return respErr('Failed to get hairstyles');
  }
}
