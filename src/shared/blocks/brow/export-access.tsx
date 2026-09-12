'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/core/i18n/navigation';
import { useAppContext } from '@/shared/contexts/app';
import type { BrowExportEntitlements } from '@/shared/lib/brow-export';

export async function saveBrowExport(response: Response, filename: string) {
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.error || 'export_failed'
    );
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useBrowExportAccess() {
  const { user, setIsShowSignModal } = useAppContext();
  const userId = user?.id;
  const router = useRouter();
  const t = useTranslations('pages.ai-brow-tint');
  const [access, setAccess] = useState<
    (BrowExportEntitlements & { userId: string }) | null
  >(null);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let active = true;
    if (userId)
      void fetch('/api/brow/export', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) return;
          const current = await response.json();
          if (active) setAccess({ ...current, userId });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  async function authorize(compare = false) {
    if (!user) {
      setIsShowSignModal(true);
      return false;
    }
    const response = await fetch('/api/brow/export', { cache: 'no-store' });
    if (response.status === 401) {
      setIsShowSignModal(true);
      return false;
    }
    if (!response.ok) throw new Error('export_failed');
    const current: BrowExportEntitlements = await response.json();
    setAccess({ ...current, userId: user.id });
    if (!current.canExport || (compare && !current.canCompare)) {
      router.push('/pricing');
      return false;
    }
    return true;
  }

  async function run(
    exporter: () => Promise<Response | null>,
    compare = false
  ) {
    if (downloading) return;
    setDownloading(true);
    try {
      if (!(await authorize(compare))) return;
      const response = await exporter();
      if (response)
        await saveBrowExport(
          response,
          compare
            ? 'browlens-style-comparison.png'
            : 'browlens-eyebrow-design.png'
        );
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'paid_export_required' || code === 'premium_required')
        router.push('/pricing');
      else if (code === 'sign_in_required') setIsShowSignModal(true);
      else toast.error(t('ui.download_failed_please_try_again'));
    } finally {
      setDownloading(false);
    }
  }

  return {
    ...(access?.userId === userId ? access : null),
    downloading,
    downloadTasks: (taskIds: string[]) =>
      run(
        () =>
          fetch('/api/brow/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds }),
          }),
        taskIds.length > 1
      ),
    downloadLocal: (prepare: () => Promise<Blob | null>) =>
      run(async () => {
        const blob = await prepare();
        if (!blob) return null;
        const form = new FormData();
        form.append('image', blob, 'brow-design.png');
        return fetch('/api/brow/export/local', { method: 'POST', body: form });
      }),
  };
}
