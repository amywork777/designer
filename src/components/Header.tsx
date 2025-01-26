'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import SignInPopup from './SignInPopup';
import { usePricing } from '@/contexts/PricingContext';
import { useDesignStore } from '@/lib/store/designs';

export default function Header() {
  const { data: session } = useSession();
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const { openPricing } = usePricing();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { clearDesigns, loadUserDesigns } = useDesignStore();

  const handleSignOut = async () => {
    clearDesigns();
    loadUserDesigns(null);
    await signOut();
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center">
            {/* Logo */}
            <div className="pl-2">
              <Link href="/" className="flex items-center gap-2">
                <img 
                  src="/images/taiyaki.svg"
                  alt="Taiyaki Logo"
                  className="w-10 h-10 sm:w-12 sm:h-12"
                />
                <span className="font-bold text-lg sm:text-xl">taiyaki</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 ml-12">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                Make
              </Link>
            </nav>

            {/* Push right section to the end */}
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <button
                onClick={openPricing}
                className="hidden sm:block text-gray-600 hover:text-gray-900"
              >
                Pricing
              </button>
              
              {session ? (
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
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
                    onClick={handleSignOut}
                    className="py-1.5 sm:py-2 px-3 sm:px-4 bg-black text-white text-sm font-dm-sans font-medium rounded-xl 
                      hover:opacity-90 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignInPopup(true)}
                  className="py-1.5 sm:py-2 px-3 sm:px-4 bg-black text-white text-sm font-dm-sans font-medium rounded-xl 
                    hover:opacity-90 transition-all"
                >
                  Sign In
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="container mx-auto px-4 py-4">
              <nav className="flex flex-col gap-4">
                <Link
                  href="/"
                  className="text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Make
                </Link>
                <button
                  onClick={() => {
                    openPricing();
                    setIsMenuOpen(false);
                  }}
                  className="text-left text-gray-600 hover:text-gray-900 py-2"
                >
                  Pricing
                </button>
              </nav>
            </div>
          </div>
        )}
      </header>

      <SignInPopup 
        isOpen={showSignInPopup} 
        onClose={() => setShowSignInPopup(false)} 
      />
    </>
  );
} 