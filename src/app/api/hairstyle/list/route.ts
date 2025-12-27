import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getHairstyles, getHairstyleCountByCategory } from '@/shared/models/hairstyle';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const status = (searchParams.get('status') || 'active') as 'active' | 'inactive';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    const hairstyles = await getHairstyles({
      category,
      status,
      page,
      limit,
    });

    // 如果需要，获取各分类的数量统计
    const includeCounts = searchParams.get('includeCounts') === 'true';
    let counts: Record<string, number> | undefined;
    if (includeCounts) {
      counts = await getHairstyleCountByCategory(status);
    }

    return respData({
      hairstyles,
      counts,
      total: hairstyles.length,
    });
  } catch (e: any) {
    console.error('Get hairstyles failed:', e);
    return respErr(`Get hairstyles failed: ${e.message || 'Unknown error'}`);
  }
}

