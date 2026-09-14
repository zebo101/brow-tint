'use client';

import { useId } from 'react';
import { Modal } from '@heroui/react/modal';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

import { SignInForm } from './sign-in-form';

export function SignModal({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('common.sign');
  const { isShowSignModal, setIsShowSignModal } = useAppContext();
  const descriptionId = useId();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Share React Aria's overlay/focus stack with the brow workspace. A separate
  // Radix/Vaul portal is treated as background and made inert by that modal.
  return (
    <Modal.Backdrop isOpen={isShowSignModal} onOpenChange={setIsShowSignModal}>
      <Modal.Container
        placement={isDesktop ? 'center' : 'bottom'}
        className={isDesktop ? undefined : 'p-0 sm:p-0'}
      >
        <Modal.Dialog
          aria-describedby={descriptionId}
          className={
            isDesktop
              ? 'max-w-[425px] rounded-lg'
              : 'max-h-[80dvh] max-w-none rounded-t-lg rounded-b-none pb-[max(1rem,env(safe-area-inset-bottom))]'
          }
        >
          {isDesktop && <Modal.CloseTrigger aria-label={t('close_title')} />}
          <Modal.Header>
            <Modal.Heading>{t('sign_in_title')}</Modal.Heading>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              {t('sign_in_description')}
            </p>
          </Modal.Header>
          <Modal.Body>
            <SignInForm callbackUrl={callbackUrl} />
          </Modal.Body>
          {!isDesktop && (
            <Modal.Footer>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setIsShowSignModal(false)}
              >
                {t('cancel_title')}
              </Button>
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
