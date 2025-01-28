'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, Clock, Package, DollarSign, 
  AlertTriangle, ArrowRight, MessageSquare,
  Loader2
} from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

interface DesignFeeDetails {
  status: 'paid' | 'pending';
  amount: number;
  customerEmail?: string;
  manufacturingMethod: string;
  productDescription: string;
  sessionId?: string;
}

function OrderConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [designFeeDetails, setDesignFeeDetails] = useState<DesignFeeDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    
    if (status === 'design_fee_paid' && sessionId) {
      fetchDesignFeeDetails(sessionId);
    }
  }, [searchParams]);

  const fetchDesignFeeDetails = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/checkout-sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch payment details');
      
      const data = await response.json();
      setDesignFeeDetails({
        status: 'paid',
        amount: data.amount_total / 100, // Convert from cents
        customerEmail: data.customer_email,
        manufacturingMethod: data.metadata.manufacturingMethod,
        productDescription: data.metadata.productDescription,
        sessionId
      });

      if (data.status === 'complete') {
        toast({
          title: "Payment Successful",
          description: "Your design fee has been received. We'll begin processing your order.",
        });
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load payment details"
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
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="space-y-8">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Design Fee Payment Confirmed</h1>
          <p className="text-gray-600">
            Thank you for your payment. We'll begin working on your manufacturing specifications.
          </p>
        </div>

        {/* Payment Details */}
        {designFeeDetails && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">Payment Details</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-medium">${designFeeDetails.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{designFeeDetails.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Manufacturing Method</span>
                <span className="font-medium">{designFeeDetails.manufacturingMethod}</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-gray-900">Next Steps</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Engineering Review</p>
                <p className="text-gray-600">
                  Our engineering team will review your design and prepare detailed manufacturing specifications.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Final Quote</p>
                <p className="text-gray-600">
                  You'll receive a comprehensive quote within 2-3 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div className="text-center">
          <button
            onClick={() => router.push('/manufacturing')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Manufacturing Options
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmation() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
} 