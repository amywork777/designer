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
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center">
            {/* Logo and Navigation grouped together */}
            <div className="flex items-center gap-12">
              <div className="pl-2">
                <Link href="/" className="flex items-center gap-2">
                  <img 
                    src="/images/taiyaki.svg"
                    alt="Taiyaki Logo"
                    className="w-12 h-12"
                  />
                  <span className="font-bold text-xl">taiyaki</span>
                </Link>
              </div>

              <nav className="flex items-center gap-6">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  Make
                </Link>
                <Link href="/about" className="text-gray-600 hover:text-gray-900">
                  About
                </Link>
              </nav>
            </div>

            {/* Push right section to the end */}
            <div className="ml-auto flex items-center gap-4">
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