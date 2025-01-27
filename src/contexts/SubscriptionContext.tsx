'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getUserSubscription } from '@/lib/firebase/subscriptions';
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

  const refreshSubscription = async () => {
    if (session?.user?.id) {
      try {
        const sub = await getUserSubscription(session.user.id);
        setTier(sub.tier);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshSubscription();
  }, [session]);

  return (
    <SubscriptionContext.Provider value={{ tier, isLoading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext); 