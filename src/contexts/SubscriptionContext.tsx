'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getUserSubscription, getSubscription, resetUserQuotas } from '@/lib/firebase/subscriptions';
import type { SubscriptionTier } from '@/lib/firebase/subscriptions';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  tier: 'free',
  isLoading: true,
  refreshSubscription: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (session?.user?.id) {
      console.log('🔍 Fetching subscription for user:', session.user.id);
      const newSubscription = await getSubscription(session.user.id);
      console.log('📦 Subscription data:', newSubscription);
      
      setTier(newSubscription.tier);
      console.log('🏷️ Current tier:', newSubscription.tier);
      
      // Only reset quotas if:
      // 1. User just upgraded to pro (no previous stripeSubscriptionId)
      // 2. New billing period started (currentPeriodEnd changed)
      const shouldResetQuotas = 
        newSubscription.tier === 'pro' && (
          !newSubscription.stripeSubscriptionId || // New subscription
          Date.now() > newSubscription.currentPeriodEnd * 1000 // New billing period
        );
      
      if (shouldResetQuotas) {
        console.log('🔄 Resetting quotas - new subscription or billing period');
        await resetUserQuotas(session.user.id);
        console.log('✅ Quotas reset complete');
      }
    } else {
      console.log('❌ No user ID available in session');
    }
    setIsLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    refreshSubscription();
  }, [session, refreshSubscription]);

  return (
    <SubscriptionContext.Provider value={{ tier, isLoading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext); 