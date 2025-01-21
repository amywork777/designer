'use client';

import { signIn } from "next-auth/react";
import { useState } from 'react';

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn('google', {
        callbackUrl: '/',
        redirect: true,
      });
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Sign in to continue</h1>
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
        </button>
      </div>
    </div>
  );
} 