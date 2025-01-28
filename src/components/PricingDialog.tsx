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
import Image from 'next/image';

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
        <div className="bg-white w-full rounded-2xl sm:max-w-4xl sm:w-full p-3 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-2 top-2 sm:right-3 sm:top-3 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors z-50"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>

          <div className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex justify-center mb-2">
              <Image
                src="/images/taiyaki.svg"
                alt="Taiyaki Logo"
                width={60}
                height={60}
                className="opacity-"
              />
            </div>

            {/* Free Section */}
            <div className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-teal-50 via-lime-50 to-amber-50">
              <div className="text-center mb-3">
                <h2 className="text-2xl sm:text-3xl font-bold font-dm-sans mb-1">Free</h2>
                <p className="text-xl font-medium font-dm-sans mb-2">Unlimited</p>
              </div>

              <div className="space-y-2">
                {[
                  'Design Generations',
                  '3D Model Renderings',
                  '3D Model (STL) Downloads',
                  '3D Printing Orders',
                  'Advanced Manufacturing Orders'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                    <div className="bg-green-100 p-1 rounded-full">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-gray-700 text-sm sm:text-base font-medium font-inter">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro CAD Section */}
            <div className="border border-gray-200 rounded-xl p-3 sm:p-4">
              <div className="text-center mb-3">
                <h2 className="text-2xl sm:text-3xl font-bold font-dm-sans mb-1">Pro CAD</h2>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl sm:text-3xl font-bold font-dm-sans">$20</span>
                  <span className="text-lg text-gray-600 font-inter">/file</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-gray-700 text-sm sm:text-base font-medium font-inter">
                  Convert your 3D model into a precision STEP engineering file in just 24-48 hours. Perfect for:
                </p>
              </div>

              <div className="space-y-2">
                {[
                  'Advanced Manufacturing Quotes & Production',
                  'Professional CAD Software Compatibility',
                  'Industry-Standard Workflows'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-700 text-sm sm:text-base font-medium font-inter">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGetStarted}
              className="w-full bg-black text-white rounded-xl py-2.5 hover:opacity-90 transition-opacity font-bold font-dm-sans text-base sm:text-lg"
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