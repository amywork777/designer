'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getUserSubscription } from '@/lib/firebase/subscriptions';
import type { SubscriptionTier } from '@/lib/firebase/subscriptions';

export function SubscriptionStatus() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionTier>('free');

  useEffect(() => {
    async function fetchSubscription() {
      if (session?.user?.id) {
        const sub = await getUserSubscription(session.user.id);
        setSubscription(sub.tier);
      }
    }

    fetchSubscription();
  }, [session]);

  if (!session) return null;

  return (
    <div className="text-sm font-medium">
      {subscription === 'pro' && (
        <span className="text-purple-600">Pro Member</span>
      )}
      {subscription === 'business' && (
        <span className="text-blue-600">Business Member</span>
      )}
    </div>
  );
} 