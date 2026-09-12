export interface BrowHistoryResult {
  id: string;
  styleName: string;
  previewUrl: string;
}

export async function loadBrowResultHistory(
  signal: AbortSignal,
  request: typeof fetch = fetch
): Promise<BrowHistoryResult[]> {
  const response = await request('/api/brow/results', {
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('history_unavailable');
  const data = await response.json();
  if (!Array.isArray(data?.results)) throw new Error('history_unavailable');
  const seen = new Set<string>();
  return data.results
    .flatMap((result: unknown) => {
      if (!result || typeof result !== 'object') return [];
      const item = result as Record<string, unknown>;
      if (
        typeof item.id !== 'string' ||
        !item.id ||
        typeof item.styleName !== 'string' ||
        seen.has(item.id)
      )
        return [];
      seen.add(item.id);
      return [
        {
          id: item.id,
          styleName: item.styleName,
          // Always use the authenticated, watermarked preview endpoint.
          previewUrl: `/api/brow/preview?taskId=${encodeURIComponent(item.id)}`,
        },
      ];
    })
    .slice(0, 40);
}
