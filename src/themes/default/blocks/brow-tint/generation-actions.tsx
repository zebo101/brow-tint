'use client';

import { Button, Checkbox, Popover, Spinner } from '@heroui/react';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { BROW_GENERATION_CREDITS } from '@/config/brow-pricing';
import { useBrowExportAccess } from '@/shared/blocks/brow/export-access';

import type { GenerationState } from './generation-lifecycle';

export const BROW_MAPPING_CREDITS = BROW_GENERATION_CREDITS;

interface BrowGenerationActionsProps {
  authenticated: boolean;
  checkingAuth: boolean;
  remainingCredits: number;
  confirmed: boolean;
  selected: boolean;
  locked: boolean;
  state: GenerationState;
  confirmationLabel?: string;
  preserveBrowShape: boolean;
  onPreserveBrowShapeChange: (selected: boolean) => void;
  onGenerate: () => void;
  onSignIn: () => void;
}

export function BrowGenerationActions({
  authenticated,
  checkingAuth,
  remainingCredits,
  confirmed,
  selected,
  locked,
  state,
  confirmationLabel,
  preserveBrowShape,
  onPreserveBrowShapeChange,
  onGenerate,
  onSignIn,
}: BrowGenerationActionsProps) {
  const t = useTranslations('pages.ai-brow-tint');
  const active = ['uploading', 'submitting', 'querying'].includes(state.phase);
  const ready = confirmed && selected;
  const insufficient = authenticated && remainingCredits < BROW_MAPPING_CREDITS;
  const label = checkingAuth
    ? t('ui.checking_account')
    : active
      ? t('ui.generating')
      : locked
        ? t('ui.awaiting_task_status')
        : !confirmed
          ? (confirmationLabel ?? t('ui.confirm_shape'))
          : !selected
            ? t('ui.choose_a_shape')
            : !authenticated
              ? t('ui.sign_in_to_generate')
              : insufficient
                ? t('ui.get_credits')
                : state.phase === 'success'
                  ? t('ui.generate_again')
                  : t('ui.generate_ai_preview');

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1 pb-1">
        <Checkbox
          name="preserveBrowShape"
          isSelected={preserveBrowShape}
          onChange={onPreserveBrowShapeChange}
          isDisabled={locked}
          className="min-h-8 items-center gap-2 text-sm"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>{t('ui.use_my_brow_adjustments')}</Checkbox.Content>
        </Checkbox>
        <Popover>
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t('ui.brow_adjustments_help')}
            className="text-muted-foreground size-8 min-w-8 shrink-0"
          >
            <CircleAlert aria-hidden="true" className="size-4" />
          </Button>
          <Popover.Content
            placement="top"
            className="max-w-[min(18rem,calc(100vw-2rem))]"
          >
            <Popover.Arrow />
            <Popover.Dialog aria-label={t('ui.brow_adjustments_help')}>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t(
                  preserveBrowShape
                    ? 'ui.brow_adjustments_on'
                    : 'ui.brow_adjustments_off'
                )}
              </p>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      <Button
        fullWidth
        variant="primary"
        isDisabled={checkingAuth || locked || !ready}
        isPending={active}
        onPress={authenticated ? onGenerate : onSignIn}
      >
        {active && <Spinner size="sm" color="current" />}
        {label}
      </Button>
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
        <span>{t('ui.2_credits_per_preview')}</span>
        {authenticated ? (
          <span>{t('ui.available', { n: remainingCredits })}</span>
        ) : (
          <span>{t('ui.your_choices_stay_after_sign_in')}</span>
        )}
      </div>
      {insufficient && ready && (
        <p className="text-muted-foreground text-xs">
          {t('ui.not_enough_credits')}
          <button
            type="button"
            onClick={onGenerate}
            disabled={locked || checkingAuth}
            className="text-foreground underline underline-offset-4"
          >
            {t('ui.get_credits')}
          </button>
        </p>
      )}
    </div>
  );
}

export function BrowGenerationStatus({
  state,
  onRetryQuery,
  loadingSample,
}: {
  state: GenerationState;
  styleSlug: string | null;
  onRetryQuery: () => void;
  loadingSample: boolean;
}) {
  const t = useTranslations('pages.ai-brow-tint');
  const access = useBrowExportAccess();
  const { phase, message, resultUrl, taskId } = state;
  const active = ['uploading', 'submitting', 'querying'].includes(phase);

  if (loadingSample || active) {
    const text = loadingSample
      ? t('ui.loading_sample')
      : phase === 'uploading'
        ? t('ui.uploading_your_confirmed_photo_and_mapping')
        : phase === 'submitting'
          ? t('ui.submitting_your_preview')
          : t('ui.creating_your_preview_this_may_take_a_moment');
    return (
      <p
        role="status"
        className="text-muted-foreground text-xs leading-relaxed"
      >
        {text}
      </p>
    );
  }
  if (phase === 'idle') return null;
  if (phase === 'success' && resultUrl) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-success text-xs">
          {t('ui.your_preview_is_ready')}
        </p>
        {access.canExport ? (
          <Button
            size="sm"
            variant="outline"
            isPending={access.downloading}
            isDisabled={!taskId}
            onPress={() => taskId && void access.downloadTasks([taskId])}
          >
            {t('ui.export_hd')}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => access.openPurchase('export')}
            className="text-sm font-semibold underline underline-offset-4"
          >
            {t('ui.upgrade_export')}
          </button>
        )}
      </div>
    );
  }
  if (phase === 'failed') {
    return (
      <p
        role="alert"
        className="text-danger text-xs leading-relaxed break-words"
      >
        {message || t('ui.generation_failed_please_try_again')}
      </p>
    );
  }
  return (
    <div role="status" className="space-y-2 text-xs leading-relaxed">
      <p className="font-medium">
        {phase === 'query-paused'
          ? t('ui.your_task_is_still_in_progress')
          : t('ui.submission_status_is_uncertain')}
      </p>
      <p className="text-muted">
        {phase === 'query-paused'
          ? t(
              'ui.your_task_is_saved_checking_again_will_not_create_another_task'
            )
          : t(
              'ui.your_request_may_have_been_received_check_task_history_before_gen'
            )}
      </p>
      {taskId && (
        <p
          className="text-muted-foreground truncate font-mono text-[10px]"
          title={taskId}
        >
          {taskId}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {phase === 'query-paused' && (
          <Button size="sm" variant="outline" onPress={onRetryQuery}>
            {t('ui.check_this_task')}
          </Button>
        )}
        <Link
          href="/activity/ai-tasks?type=image"
          className="underline underline-offset-4"
        >
          {t('ui.task_history')}
        </Link>
      </div>
    </div>
  );
}
