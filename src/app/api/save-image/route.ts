import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download image');
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const filename = `${nanoid()}.${contentType.split('/')[1]}`;

    // Upload to Vercel Blob storage
    const { url } = await put(
      `designs/${filename}`, 
      imageBlob, 
      {
        access: 'public',
        addRandomSuffix: false,
        contentType
      }
    );

    return NextResponse.json({ 
      success: true, 
      url 
    });

  } catch (error) {
    console.error('Save image error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save image'
      }, 
      { status: 500 }
    );
  }
} 