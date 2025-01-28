'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';

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

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
      if (!response.ok) throw new Error('Failed to fetch order details');
      
      const data = await response.json();
      setOrderDetails(data);

      // Send order notification email
      await fetch('/api/send-order-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderType: data.metadata.type === 'step_file' ? 'STEP_FILE' : '3D_PRINT',
          orderDetails: data,
          sessionId
        })
      });

      if (data.status === 'complete') {
        toast({
          title: "Order Confirmed",
          description: "Your payment has been received. Check your email for details.",
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load order details"
      });
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

          <Button
            onClick={() => router.push('/')}
            variant="ghost"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Home
          </Button>
          
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

export default function OrderSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
} 