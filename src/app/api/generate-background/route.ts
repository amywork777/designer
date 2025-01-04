import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();

    // First, generate the background using DALL-E
    const backgroundResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a background scene: ${prompt}. Make it suitable for product photography.`,
      size: "1024x1024",
      quality: "hd",
    });

    const backgroundUrl = backgroundResponse.data[0].url;

    // Download both images
    const [foregroundRes, backgroundRes] = await Promise.all([
      fetch(imageUrl),
      fetch(backgroundUrl)
    ]);

    const [foregroundBuffer, backgroundBuffer] = await Promise.all([
      foregroundRes.arrayBuffer(),
      backgroundRes.arrayBuffer()
    ]);

    // Process and merge images using sharp
    const composite = await sharp(Buffer.from(backgroundBuffer))
      .composite([
        {
          input: Buffer.from(foregroundBuffer),
          gravity: 'center'
        }
      ])
      .toBuffer();

    // Convert to base64
    const base64Image = composite.toString('base64');
    const processedImageUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl: processedImageUrl
    });

  } catch (error) {
    console.error('Error generating background:', error);
    return NextResponse.json(
      { error: 'Failed to generate background' },
      { status: 500 }
    );
  }
} 