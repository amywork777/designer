'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { PricingDialog } from '@/components/PricingDialog';

interface PricingContextType {
  openPricing: () => void;
  closePricing: () => void;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const openPricing = () => setIsPricingOpen(true);
  const closePricing = () => setIsPricingOpen(false);

  return (
    <PricingContext.Provider value={{ openPricing, closePricing }}>
      {children}
      <PricingDialog isOpen={isPricingOpen} onClose={closePricing} />
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
}