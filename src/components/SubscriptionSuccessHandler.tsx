'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/components/ui/use-toast';

export function SubscriptionSuccessHandler() {
  const searchParams = useSearchParams();
  const { refreshSubscription } = useSubscription();
  const { toast } = useToast();

  useEffect(() => {
    const handleSuccess = async () => {
      if (searchParams.get('subscription_success') === 'true') {
        console.log('🎉 Subscription success detected');
        try {
          console.log('🔄 Refreshing subscription data...');
          await refreshSubscription();
          console.log('✅ Subscription data refreshed');
          
          toast({
            title: "Subscription Updated",
            description: "Your subscription has been successfully updated!",
            duration: 5000,
          });
        } catch (error) {
          console.error('❌ Error refreshing subscription:', error);
          toast({
            title: "Error",
            description: "There was a problem updating your subscription.",
            variant: "destructive",
          });
        }
      }
    };

    handleSuccess();
  }, [searchParams]);

  return null;
}