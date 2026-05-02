'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Renders nothing until `requestIdleCallback` fires (or a 1.5s timeout
 * elapses). Use to delay non-critical clients like the page-nav progress
 * bar or UTM cookie capture so they don't run during initial hydration
 * and inflate mobile TBT.
 *
 * Trade-off: wrapped components mount ~50-300 ms after the browser is
 * idle. For UI like a top progress bar, that's invisible to the user (it
 * was already idle). For UTM capture, the cookie is still set well within
 * the same session.
 */
export function DeferUntilIdle({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // useEffect only runs in the browser, so `window` is defined here.
    // Cast to `any` so TS doesn't narrow `window` away after the
    // `'requestIdleCallback' in window` check (it doesn't appear in the
    // standard Window lib type).
    const w: any = window;
    let cancelled = false;
    const fire = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(fire, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    // Fallback for browsers without requestIdleCallback (Safari historically).
    const t = w.setTimeout(fire, 200);
    return () => {
      cancelled = true;
      w.clearTimeout(t);
    };
  }, []);

  return ready ? <>{children}</> : null;
}
