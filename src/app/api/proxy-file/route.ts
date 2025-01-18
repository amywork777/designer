import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const buffer = await response.arrayBuffer();

    const headers = new Headers();
    if (contentType) headers.set('content-type', contentType);
    if (contentLength) headers.set('content-length', contentLength);
    headers.set('cache-control', 'public, max-age=31536000');

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch file' }), 
      { 
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
} 