'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="text-red-500 mb-6">
          {error === 'AccessDenied' 
            ? 'You do not have permission to sign in'
            : 'There was a problem signing in'}
        </p>
        <Link 
          href="/"
          className="text-blue-500 hover:text-blue-600 underline"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}