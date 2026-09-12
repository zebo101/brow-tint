import { createHash } from 'node:crypto';

import {
  BrowExportError,
  browExportMetadata,
  browResultUrl,
} from '@/shared/lib/brow-export';
import { browExportErrorResponse } from '@/shared/lib/brow-export-handlers';
import { getAITasks } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) throw new BrowExportError('sign_in_required', 401);
    const [entitlements, tasks] = await Promise.all([
      getBrowEntitlements(user.id),
      getAITasks({
        userId: user.id,
        mediaType: 'image',
        status: 'success',
        limit: 40,
      }),
    ]);
    const results = tasks.flatMap((task) => {
      const metadata = browExportMetadata(task);
      if (!metadata || task.scene !== 'image-to-image' || !browResultUrl(task))
        return [];
      return [
        {
          id: task.id,
          styleId: metadata.styleId,
          styleName: metadata.styleName,
          photoGroup: createHash('sha256')
            .update(metadata.source)
            .digest('hex'),
          previewUrl: `/api/brow/preview?taskId=${encodeURIComponent(task.id)}`,
          createdAt: task.createdAt,
        },
      ];
    });
    return Response.json(
      { entitlements, results },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return browExportErrorResponse(error);
  }
}
