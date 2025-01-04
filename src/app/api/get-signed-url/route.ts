import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    // For now, just return the original URL
    // In production, you'd implement proper URL signing here
    return NextResponse.json({
      success: true,
      signedUrl: imageUrl
    });

  } catch (error) {
    console.error('Error signing URL:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to sign URL' 
    }, { status: 500 });
  }
} 