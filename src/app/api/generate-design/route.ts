import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { prompt, reference } = await req.json();

    console.log('Generating with prompt:', prompt.substring(0, 100) + '...');

    let response;

    if (reference) {
      try {
        // Extract base64 data
        const base64Data = reference.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('Original image size:', imageBuffer.length / 1024, 'KB');

        // Process image with sharp - more aggressive compression
        const processedBuffer = await sharp(imageBuffer)
          .resize(256, 256, { // Reduce size further
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .jpeg({ // Use JPEG instead of PNG for smaller file size
            quality: 60,
            mozjpeg: true
          })
          .toBuffer();

        console.log('Processed image size:', processedBuffer.length / 1024, 'KB');

        // More strict size check
        if (processedBuffer.length > 500 * 1024) { // 500KB limit
          throw new Error('Processed image is still too large');
        }

        response = await openai.images.edit({
          image: processedBuffer,
          prompt,
          n: 1,
          size: "512x512",
        });
      } catch (error) {
        console.error('Image processing error:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        throw new Error('Failed to process image. Please try a smaller or simpler image.');
      }
    } else {
      // Text-to-image generation
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "512x512",
        quality: "standard",
        style: "natural",
      });
    }

    if (!response.data || response.data.length === 0) {
      throw new Error('No images generated');
    }

    return NextResponse.json({
      success: true,
      images: response.data.map(img => img.url)
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate images'
      },
      { status: 500 }
    );
  }
} 