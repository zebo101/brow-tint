export interface BrowExportEntitlements {
  canExport: boolean;
  canCompare: boolean;
}

export interface BrowExportTask {
  id: string;
  userId: string;
  status: string;
  mediaType: string;
  scene?: string | null;
  costCredits?: number | null;
  options?: string | null;
  taskInfo?: string | null;
  taskResult?: string | null;
  taskId?: string | null;
  createdAt?: Date;
}

export class BrowExportError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
function parse(raw: string | null | undefined): Record<string, unknown> {
  try {
    return record(JSON.parse(raw || '{}'));
  } catch {
    return {};
  }
}

export function browExportMetadata(
  task: BrowExportTask
): { styleId: string; styleName: string; source: string } | null {
  const value = record(parse(task.options).__browExport);
  return value &&
    typeof value.styleId === 'string' &&
    value.styleId &&
    typeof value.styleName === 'string' &&
    typeof value.source === 'string' &&
    value.source
    ? {
        styleId: value.styleId,
        styleName: value.styleName,
        source: value.source,
      }
    : null;
}

export function isBrowTask(task: BrowExportTask): boolean {
  return (
    !!parse(task.options).__browExport ||
    (task.mediaType === 'image' &&
      task.scene === 'image-to-image' &&
      task.costCredits === 2)
  );
}

/** Keep provider payloads server-side even for paid users; download checks current entitlement. */
export function serializeBrowTaskForClient<T extends BrowExportTask>(
  task: T,
  entitlements: BrowExportEntitlements
) {
  if (!isBrowTask(task))
    return { ...task, canExport: false, canCompare: false };
  const previewUrl = `/api/brow/preview?taskId=${encodeURIComponent(task.id)}`;
  return {
    id: task.id,
    status: task.status,
    mediaType: task.mediaType,
    scene: task.scene,
    costCredits: task.costCredits,
    createdAt: task.createdAt,
    taskInfo:
      task.status === 'success'
        ? JSON.stringify({ images: [{ imageUrl: previewUrl }] })
        : null,
    taskResult: null,
    options: null,
    taskId: null,
    canExport: entitlements.canExport,
    canCompare: entitlements.canCompare,
  };
}

export function assertBrowExportAccess(
  tasks: BrowExportTask[],
  userId: string,
  entitlements: BrowExportEntitlements
): void {
  if (!entitlements.canExport)
    throw new BrowExportError('paid_export_required', 403);
  if (
    tasks.length < 1 ||
    tasks.length > 4 ||
    new Set(tasks.map((t) => t.id)).size !== tasks.length
  ) {
    throw new BrowExportError('invalid_selection');
  }
  if (tasks.length > 1 && !entitlements.canCompare)
    throw new BrowExportError('premium_required', 403);
  for (const task of tasks) {
    if (task.userId !== userId)
      throw new BrowExportError('result_not_found', 404);
    if (
      !isBrowTask(task) ||
      task.mediaType !== 'image' ||
      task.scene !== 'image-to-image' ||
      task.status !== 'success' ||
      !browExportMetadata(task)
    ) {
      throw new BrowExportError('result_not_ready', 409);
    }
  }
  if (tasks.length > 1) {
    const metadata = tasks.map((task) => browExportMetadata(task)!);
    if (new Set(metadata.map((item) => item.source)).size !== 1)
      throw new BrowExportError('same_photo_required');
    if (new Set(metadata.map((item) => item.styleId)).size !== tasks.length)
      throw new BrowExportError('different_styles_required');
  }
}

/** Provider outputs only: never recursively inspect options or source inputs. */
export function browResultUrl(task: BrowExportTask): string | null {
  for (const raw of [task.taskInfo, task.taskResult]) {
    const value = parse(raw);
    let result = record(value.data).resultJson ?? value.resultJson;
    if (typeof result === 'string') result = parse(result);
    const output =
      record(result).resultUrls ??
      value?.output ??
      value?.images ??
      value?.data ??
      value?.image;
    const entries = Array.isArray(output) ? output : [output];
    for (const entry of entries) {
      const image = record(entry);
      const url =
        typeof entry === 'string'
          ? entry
          : (image.imageUrl ??
            image.url ??
            image.uri ??
            image.src ??
            image.image);
      if (typeof url === 'string' && /^https:\/\//i.test(url)) return url;
    }
  }
  return null;
}
