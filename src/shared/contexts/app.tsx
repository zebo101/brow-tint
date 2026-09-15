'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthClient, GOOGLE_ONE_TAP_CONTAINER_ID } from '@/core/auth/client';
import { envConfigs } from '@/config';
import { User } from '@/shared/models/user';

import { BrowPurchaseProvider } from './brow-purchase';

export interface ContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isCheckSign: boolean;
  setIsCheckSign: (isCheckSign: boolean) => void;
  isShowSignModal: boolean;
  setIsShowSignModal: (show: boolean) => void;
  isShowPaymentModal: boolean;
  setIsShowPaymentModal: (show: boolean) => void;
  configs: Record<string, string>;
  fetchConfigs: () => Promise<void>;
  fetchUserCredits: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
  showOneTap: (configs: Record<string, string>) => Promise<void>;
}

const AppContext = createContext({} as ContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});

  // sign user
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);

  // is check sign (true during SSR and initial render to avoid hydration mismatch when auth is enabled)
  const [isCheckSign, setIsCheckSign] = useState(!!envConfigs.auth_secret);

  // show sign modal
  const [isShowSignModal, setIsShowSignModal] = useState(false);

  // show payment modal
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const resp = await fetch('/api/config/get-configs', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setConfigs(data);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('fetch configs failed:', e);
      }
    }
  }, []);

  const fetchUserCredits = useCallback(async () => {
    try {
      if (!userRef.current) {
        return;
      }

      const resp = await fetch('/api/user/get-user-credits', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser((prev: User | null) =>
        prev ? { ...prev, credits: data } : prev
      );
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('fetch user credits failed:', e);
      }
    }
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const resp = await fetch('/api/user/get-user-info', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser(data);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('fetch user info failed:', e);
      }
    }
  }, []);

  const showOneTap = useCallback(async (configs: Record<string, string>) => {
    // Mobile GIS ignores prompt_parent_id, so its automatic iframe cannot join
    // our modal stack. Keep Google sign-in user-initiated on touch devices.
    // Check here (before the asynchronous SDK load) for every caller.
    if (
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(any-pointer: coarse)').matches
    ) {
      return;
    }
    try {
      const authClient = getAuthClient(configs);
      await authClient.oneTap({
        callbackURL: '/',
        autoSelect: false,
        cancelOnTapOutside: true,
        onPromptNotification: (notification) => {
          // Handle prompt dismissal silently
          // This callback is triggered when the prompt is dismissed or skipped
          if (process.env.NODE_ENV !== 'production') {
            console.log('One Tap prompt notification:', notification);
          }
        },
        // fetchOptions: {
        //   onSuccess: () => {
        //     router.push('/');
        //   },
        // },
      });
    } catch {
      // Silently handle One Tap cancellation errors
      // These errors occur when users close the prompt or decline to sign in
      // Common errors: FedCM NetworkError, AbortError, etc.
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Checkout uses a separate tab so returning must refresh the retained studio,
  // even when its purchase dialog was already closed.
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchUserCredits();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id, fetchUserCredits]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isCheckSign,
      setIsCheckSign,
      isShowSignModal,
      setIsShowSignModal,
      isShowPaymentModal,
      setIsShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    }),
    [
      user,
      isCheckSign,
      isShowSignModal,
      isShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {/* Google injects its iframe asynchronously, sometimes after the editor
          opens. Keep this external overlay in React Aria's focus/interaction
          layer so the editor cannot mark the prompt inert. */}
      <div
        id={GOOGLE_ONE_TAP_CONTAINER_ID}
        data-react-aria-top-layer=""
        className="pointer-events-auto relative z-[100]"
      />
      <BrowPurchaseProvider>{children}</BrowPurchaseProvider>
    </AppContext.Provider>
  );
};
