'use client';

import { CheckCircle2, Clock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function QuoteConfirmation() {
  const router = useRouter();

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
          <h1 className="text-2xl font-bold text-gray-900">Quote Request Submitted</h1>
          <p className="text-gray-600">
            Thank you for your quote request. Our team will review your design and requirements.
          </p>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-medium text-gray-900">Next Steps</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Quote Preparation</p>
                <p className="text-gray-600">
                  Our team will analyze your design and prepare a detailed quote.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Email Confirmation</p>
                <p className="text-gray-600">
                  You'll receive your custom quote within 1-2 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div className="text-center space-y-8">
          <Button
            onClick={() => router.push('/')}
            variant="ghost"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Home
          </Button>

          {/* Taiyaki Logo */}
          <div className="flex justify-center pt-8">
            <Image
              src="/images/taiyaki.svg"
              alt="Taiyaki Logo"
              width={120}
              height={120}
              className="opacity-50 hover:opacity-75 transition-opacity"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 