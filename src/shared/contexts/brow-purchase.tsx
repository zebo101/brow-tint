'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

import PurchaseDialog from '@/shared/blocks/brow/purchase-dialog';

type PurchaseReason = 'export' | 'compare' | 'credits';
const PurchaseContext = createContext<(reason?: PurchaseReason) => void>(
  () => {}
);
export const useBrowPurchase = () => useContext(PurchaseContext);

// Keep the editor and history mounted underneath the purchase overlay.
export function BrowPurchaseProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<PurchaseReason | null>(null);
  return (
    <PurchaseContext.Provider value={(next = 'export') => setReason(next)}>
      {children}
      {reason && (
        <PurchaseDialog reason={reason} onClose={() => setReason(null)} />
      )}
    </PurchaseContext.Provider>
  );
}
