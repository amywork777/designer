'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Infinity, X } from "lucide-react";
import SignInPopup from '@/components/SignInPopup';
import { loadStripe } from '@stripe/stripe-js';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';

interface PricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PricingDialog({ isOpen, onClose }: PricingDialogProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [showSignInPopup, setShowSignInPopup] = useState(false);

  const handleSubscription = async (priceId?: string) => {
    if (!session?.user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to continue with subscription",
        variant: "destructive",
      });
      return;
    }

    if (!priceId) {
      // Handle free tier
      onClose();
      return;
    }

    try {
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: session.user.id,
          email: session.user.email,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error('Stripe failed to initialize');

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: "Failed to start subscription",
        variant: "destructive",
      });
    }
  };

  const handleGetStarted = () => {
    if (!session?.user) {
      setShowSignInPopup(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
        <div className="bg-white w-full sm:rounded-2xl sm:max-w-6xl sm:w-full p-4 sm:p-8 relative min-h-screen sm:min-h-0">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 sm:-right-3 sm:-top-3 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="space-y-8">
            {/* Free Account Section */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-teal-50 via-lime-50 to-amber-50">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Free With Every Account</h2>
              </div>

              <div className="space-y-4">
                {[
                  'Unlimited 3D model designs',
                  'Unlimited STL downloads',
                  'Unlimited 3D printing orders',
                  'Unlimited manufacturing orders'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white/60 p-3 rounded-lg">
                    <div className="bg-green-100 p-1.5 rounded-full">
                      <Infinity className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Professional CAD Files Section */}
            <div className="border border-gray-200 rounded-xl p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Professional CAD Files</h2>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-4xl font-bold">$20</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-gray-700">
                  Our engineering team converts your 3D model to professional CAD format (STEP file) for $20 (24-48h turnaround). Required for:
                </p>
              </div>

              <div className="space-y-3">
                {[
                  'Advanced manufacturing quotes & production',
                  'Professional CAD software compatibility',
                  'Industry-standard workflows'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-blue-500" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGetStarted}
              className="w-full bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <SignInPopup 
        isOpen={showSignInPopup}
        onClose={() => setShowSignInPopup(false)}
      />
    </>
  );
} 