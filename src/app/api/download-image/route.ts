import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'No image URL provided' },
        { status: 400 }
      );
    }

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }

    // Get the image data as a buffer
    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/png');
    headers.set('Content-Disposition', 'attachment; filename="generated-design.png"');
    headers.set('Cache-Control', 'no-cache');

    // Return the image as a downloadable file
    return new NextResponse(imageBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download image' },
      { status: 500 }
    );
  }
} 