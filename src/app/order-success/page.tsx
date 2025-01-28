'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from "@/components/ui/use-toast";

interface OrderDetails {
  status: string;
  amount_total: number;
  customer_email: string;
  metadata: {
    type: 'step_file' | '3d_print';
    material?: string;
    size?: string;
    designId: string;
  };
}

export default function OrderSuccess() {
  const searchParams = useSearchParams();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Add a small delay to allow Stripe to process the session
      setTimeout(() => {
        fetchOrderDetails(sessionId);
      }, 1000);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const fetchOrderDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/checkout-sessions/${sessionId}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.log('Session not ready yet, retrying...');
        // If the session isn't ready, try again after a delay
        setTimeout(() => fetchOrderDetails(sessionId), 1000);
        return;
      }
      
      setOrderDetails(data);

      if (data.status === 'complete') {
        toast({
          title: "Order Confirmed",
          description: "We'll send you an email with further details.",
        });
      }
    } catch (error) {
      console.log('Session details not available yet');
      // Don't show error to user, just retry
      setTimeout(() => fetchOrderDetails(sessionId), 1000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900">
            Thank you for your order!
          </h1>
          
          <p className="text-gray-600">
            Check your email for details about delivery.
          </p>

          {orderDetails && (
            <div className="mt-8 text-sm text-gray-500">
              Order Total: ${(orderDetails.amount_total / 100).toFixed(2)}
            </div>
          )}
          
          <div className="mt-12">
            <Image
              src="/images/taiyaki.svg"
              alt="Taiyaki Logo"
              width={120}
              height={120}
              className="mx-auto opacity-50 grayscale"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 