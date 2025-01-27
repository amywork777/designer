'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getUserSubscription, getSubscription, resetUserQuotas } from '@/lib/firebase/subscriptions';
import type { SubscriptionTier, UserSubscription, PlanType } from '@/lib/firebase/subscriptions';

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  setSubscription: React.Dispatch<React.SetStateAction<UserSubscription | null>>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  setSubscription: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  useEffect(() => {
    async function fetchSubscription() {
      if (session?.user?.id) {
        console.log('🔍 Fetching subscription for user:', session.user.id);
        try {
          const sub = await getUserSubscription(session.user.id);
          console.log('📦 Subscription data:', sub);
          
          // Handle both tier and planType for backwards compatibility
          const currentPlan = sub.planType || sub.tier || 'free';
          console.log('🏷️ Current plan:', currentPlan);
          
          setSubscription({
            ...sub,
            planType: currentPlan as PlanType // Ensure we're using planType going forward
          });
        } catch (error) {
          console.error('Error fetching subscription:', error);
        }
      }
    }

    fetchSubscription();
  }, [session?.user?.id]);

  return (
    <SubscriptionContext.Provider value={{ subscription, setSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext); 