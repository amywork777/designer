import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add Vercel-specific headers
  const response = NextResponse.next();
  response.headers.set('x-vercel-cache', 'HIT');
  return response;
}

export const config = {
  matcher: '/api/:path*',
}; 