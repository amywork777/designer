import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return NextResponse.json({
      success: true,
      dataUrl: `data:${contentType};base64,${base64}`
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to proxy image' 
    }, { status: 500 });
  }
} 