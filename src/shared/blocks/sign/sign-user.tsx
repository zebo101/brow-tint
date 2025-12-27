'use client';

import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { Coins, LayoutDashboard, Loader2, LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { authClient, signOut, useSession } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { User as UserType } from '@/shared/models/user';
import { NavItem, UserNav } from '@/shared/types/blocks/common';

import { SmartIcon } from '../common/smart-icon';
import { SignModal } from './sign-modal';

function extractSessionUser(data: any): UserType | null {
  const u = data?.user ?? data?.data?.user ?? null;
  return u && typeof u === 'object' ? (u as UserType) : null;
}

export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // get app context values
  const {
    configs,
    fetchConfigs,
    setIsShowSignModal,
    isCheckSign,
    setIsCheckSign,
    user,
    setUser,
    fetchUserInfo,
    showOneTap,
  } = useAppContext();

  // get session
  const { data: session, isPending } = useSession();
  const sessionUser = extractSessionUser(session);
  const displayUser = (user as UserType | null) ?? sessionUser;

  // In dev (React StrictMode) effects can run twice; ensure we don't spam getSession().
  const didFallbackSyncRef = useRef(false);

  // one tap initialized
  const oneTapInitialized = useRef(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  // set is check sign
  useEffect(() => {
    setIsCheckSign(isPending);
  }, [isPending]);

  // show one tap if not initialized
  useEffect(() => {
    if (
      configs &&
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true' &&
      !session &&
      !isPending &&
      !oneTapInitialized.current
    ) {
      oneTapInitialized.current = true;
      showOneTap(configs);
    }
  }, [configs, session, isPending]);

  // set user
  useEffect(() => {
    const currentUserId = user?.id;
    const sessionUserId = (sessionUser as any)?.id;

    if (sessionUser && sessionUserId !== currentUserId) {
      setUser(sessionUser as UserType);
      fetchUserInfo();
    } else if (!sessionUser && currentUserId) {
      setUser(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id, (sessionUser as any)?.email, user?.id]);

  // Fallback: if the session cookie is present but useSession lags, do a single refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (didFallbackSyncRef.current) return;
    // Only run when useSession is done but still no user.
    if (isPending) return;
    if (sessionUser || user) return;

    didFallbackSyncRef.current = true;
    void (async () => {
      try {
        const res: any = await authClient.getSession();
        const fresh = extractSessionUser(res?.data ?? res);
        if (fresh?.id) {
          setUser(fresh);
          fetchUserInfo();
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, sessionUser, user?.id]);

  return (
    <>
      {isCheckSign || !mounted ? (
        <div>
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : displayUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0"
            >
              <Avatar>
                <AvatarImage
                  src={displayUser.image || ''}
                  alt={displayUser.name || ''}
                />
                <AvatarFallback>{displayUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {userNav?.show_name && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/profile"
                  >
                    <User />
                    {displayUser.name}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_credits && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/credits"
                  >
                    <Coins />
                    {t('credits_title', {
                      credits: displayUser.credits?.remainingCredits || 0,
                    })}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.items?.map((item: NavItem, idx: number) => (
              <Fragment key={idx}>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href={item.url || ''}
                    target={item.target || '_self'}
                  >
                    {item.icon && (
                      <SmartIcon
                        name={item.icon as string}
                        className="h-4 w-4"
                      />
                    )}
                    {item.title}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </Fragment>
            ))}

            {displayUser.isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link className="w-full cursor-pointer" href="/admin">
                    <LayoutDashboard />
                    {t('admin_title')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_sign_out && (
              <DropdownMenuItem
                className="w-full cursor-pointer"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        router.push('/');
                      },
                    },
                  })
                }
              >
                <LogOut />
                <span>{t('sign_out_title')}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
          <Button
            variant="outline"
            size={signButtonSize}
            className={cn(
              'ml-4 inline-flex cursor-pointer items-center justify-center gap-[9.9px] rounded-[165.36px] border-none px-[19.8px] py-[18.9px]',
              // 白天模式样式 - 深色文字配浅色半透明背景
              'bg-white/50 backdrop-blur-sm',
              'shadow-[0px_13.97px_24.9px_rgba(0,0,0,0.12),inset_0px_0px_12.25px_rgba(255,255,255,0.3)]',
              '[background:linear-gradient(107.66deg,rgba(255,255,255,0.6)_-54.59%,rgba(255,255,255,0.4)_121.78%)]',
              'text-gray-900 hover:bg-white/60 hover:shadow-[0px_13.97px_24.9px_rgba(0,0,0,0.18),inset_0px_0px_12.25px_rgba(255,255,255,0.4)]',
              // 暗色模式样式 - 白色文字配深色半透明背景
              'dark:bg-transparent dark:backdrop-blur-sm',
              'dark:shadow-[0px_13.97px_24.9px_rgba(0,0,0,0.25),inset_0px_0px_12.25px_rgba(255,255,255,0.25)]',
              'dark:[background:linear-gradient(107.66deg,rgba(255,255,255,0.1)_-54.59%,rgba(255,255,255,0.01)_121.78%)]',
              'dark:text-white dark:hover:bg-white/20',
              isScrolled && 'lg:hidden'
            )}
            onClick={() => setIsShowSignModal(true)}
          >
            <span className="font-['Euclid_Circular_B'] text-[15.8px] leading-[91.3%] font-medium tracking-[-0.63px]">
              {t('sign_in_title')}
            </span>
          </Button>
          <SignModal />
        </div>
      )}
    </>
  );
}
