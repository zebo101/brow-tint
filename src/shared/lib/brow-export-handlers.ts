import {
  composeBrowComparison,
  MAX_BROW_IMAGE_BYTES,
  normalizeBrowExport,
  renderBrowPreview,
} from '../services/brow-export-image';
import {
  assertBrowExportAccess,
  BrowExportError,
  browExportMetadata,
  isBrowTask,
  type BrowExportEntitlements,
  type BrowExportTask,
} from './brow-export';

export interface BrowExportDependencies {
  user: () => Promise<{ id: string } | null | undefined>;
  entitlements: (userId: string) => Promise<BrowExportEntitlements>;
  task: (id: string) => Promise<BrowExportTask | null | undefined>;
  image: (task: BrowExportTask) => Promise<Buffer>;
}

const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};
async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit)
    throw new BrowExportError('image_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new BrowExportError('invalid_image');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new BrowExportError('image_too_large', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
function imageResponse(image: Buffer, preview = false, comparison = false) {
  return new Response(new Uint8Array(image), {
    headers: {
      ...privateHeaders,
      'Content-Type': preview ? 'image/jpeg' : 'image/png',
      ...(preview
        ? {}
        : {
            'Content-Disposition': `attachment; filename="browlens-${comparison ? 'style-comparison' : 'eyebrow-design'}.png"`,
          }),
    },
  });
}
export function browExportErrorResponse(error: unknown) {
  return Response.json(
    {
      error: error instanceof BrowExportError ? error.message : 'export_failed',
    },
    {
      status: error instanceof BrowExportError ? error.status : 500,
      headers: privateHeaders,
    }
  );
}

export function createBrowExportHandlers(deps: BrowExportDependencies) {
  async function user() {
    const result = await deps.user();
    if (!result) throw new BrowExportError('sign_in_required', 401);
    return result;
  }
  async function paid() {
    const current = await user();
    const entitlements = await deps.entitlements(current.id);
    if (!entitlements.canExport)
      throw new BrowExportError('paid_export_required', 403);
    return { current, entitlements };
  }
  return {
    async export(request: Request) {
      try {
        const { current, entitlements } = await paid();
        const text = (await readLimitedBody(request, 2048)).toString();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new BrowExportError('invalid_selection');
        }
        const ids = body?.taskIds;
        if (
          !Array.isArray(ids) ||
          ids.length < 1 ||
          ids.length > 4 ||
          ids.some((id) => typeof id !== 'string' || !id || id.length > 128) ||
          new Set(ids).size !== ids.length
        )
          throw new BrowExportError('invalid_selection');
        if (ids.length > 1 && !entitlements.canCompare)
          throw new BrowExportError('premium_required', 403);
        const tasks = await Promise.all(ids.map((id) => deps.task(id)));
        if (tasks.some((task) => !task))
          throw new BrowExportError('result_not_found', 404);
        const found = tasks as BrowExportTask[];
        assertBrowExportAccess(found, current.id, entitlements);
        const images = await Promise.all(
          found.map(async (task) => ({
            image: await deps.image(task),
            label: browExportMetadata(task)!.styleName,
          }))
        );
        return imageResponse(
          images.length === 1
            ? await normalizeBrowExport(images[0].image)
            : await composeBrowComparison(images),
          false,
          images.length > 1
        );
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
    async preview(request: Request) {
      try {
        const current = await user();
        const id = new URL(request.url).searchParams.get('taskId');
        if (!id || id.length > 128)
          throw new BrowExportError('result_not_found', 404);
        const task = await deps.task(id);
        if (!task || task.userId !== current.id)
          throw new BrowExportError('result_not_found', 404);
        if (!isBrowTask(task) || task.status !== 'success')
          throw new BrowExportError('result_not_ready', 409);
        return imageResponse(
          await renderBrowPreview(await deps.image(task)),
          true
        );
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
    async local(request: Request) {
      try {
        await paid();
        const body = await readLimitedBody(
          request,
          MAX_BROW_IMAGE_BYTES + 1024 * 1024
        );
        const form = await new Response(new Uint8Array(body), {
          headers: {
            'Content-Type': request.headers.get('content-type') || '',
          },
        }).formData();
        const file = form.get('image');
        if (
          !file ||
          typeof file === 'string' ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
        )
          throw new BrowExportError('invalid_image');
        if (file.size > MAX_BROW_IMAGE_BYTES)
          throw new BrowExportError('image_too_large', 413);
        return imageResponse(
          await normalizeBrowExport(Buffer.from(await file.arrayBuffer()))
        );
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
    async entitlements() {
      try {
        const current = await user();
        return Response.json(await deps.entitlements(current.id), {
          headers: privateHeaders,
        });
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
  };
}
