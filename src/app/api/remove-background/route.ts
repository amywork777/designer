import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    
    // Call remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'Api-Key': process.env.REMOVE_BG_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        size: 'regular',
        type: 'product',
        format: 'png',
        bg_color: null
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to remove background');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      imageUrl: data.data.result_url
    });

  } catch (error) {
    console.error('Error removing background:', error);
    return NextResponse.json(
      { error: 'Failed to remove background' },
      { status: 500 }
    );
  }
} 