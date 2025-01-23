'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import SignInPopup from './SignInPopup';
import { usePricing } from '@/contexts/PricingContext';

export default function Header() {
  const { data: session } = useSession();
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const { openPricing } = usePricing();

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center font-dm-sans font-medium text-xl">
              taiyaki
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link 
                href="/design" 
                className="font-dm-sans font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Design
              </Link>
              <Link 
                href="/make" 
                className="font-dm-sans font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Make
              </Link>
              <Link 
                href="/about" 
                className="font-dm-sans font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                About
              </Link>
            </nav>

            {/* Right section */}
            <div className="flex items-center gap-4">
              <button
                onClick={openPricing}
                className="text-gray-600 hover:text-gray-900"
              >
                Pricing
              </button>
              
              {session ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
                    {session.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt="Profile"
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                        {session.user?.email?.[0].toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="font-dm-sans font-medium text-sm">
                      {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="py-2 px-4 bg-black text-white font-dm-sans font-medium rounded-xl 
                      hover:opacity-90 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignInPopup(true)}
                  className="py-2 px-4 bg-black text-white font-dm-sans font-medium rounded-xl 
                    hover:opacity-90 transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <SignInPopup 
        isOpen={showSignInPopup} 
        onClose={() => setShowSignInPopup(false)} 
      />
    </>
  );
} 