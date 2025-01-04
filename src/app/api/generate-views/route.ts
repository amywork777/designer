import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    
    if (!image) {
      throw new Error('No image provided');
    }

    // Convert base64 to buffer
    const base64Data = image.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Simple processing - just resize and convert to PNG
    const processedBuffer = await sharp(imageBuffer)
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    // Generate variation
    const response = await openai.images.edit({
      image: processedBuffer,
      prompt: "Create a professional product visualization, maintaining the same style and design",
      n: 1,
      size: "1024x1024",
    });

    return NextResponse.json({
      success: true,
      images: [response.data[0].url]
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate variations. Please try a simpler image.'
    }, { status: 500 });
  }
} 