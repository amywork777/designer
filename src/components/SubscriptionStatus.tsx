'use client';

import { useSubscription } from '@/contexts/SubscriptionContext';

export function SubscriptionStatus() {
  const { tier } = useSubscription();

  return (
    <div className="text-sm font-medium">
      {tier === 'pro' && (
        <span className="text-purple-600">Pro Member</span>
      )}
      {tier === 'business' && (
        <span className="text-blue-600">Business Member</span>
      )}
    </div>
  );
} 