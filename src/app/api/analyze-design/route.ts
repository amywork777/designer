import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Add retry logic
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

async function processImage(imageUrl: string): Promise<string> {
  try {
    let imageBuffer: Buffer;

    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('Invalid image URL format');
    }

    // Process image: convert to PNG and remove background
    const processedBuffer = await sharp(imageBuffer)
      .png()
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toBuffer();

    return `data:image/png;base64,${processedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    const processedImageUrl = await processImage(imageUrl);

    const response = await retryOperation(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Focus only on describing the main 3D object. Ignore any background or environmental elements."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: prompt || "Describe only the main 3D object's key visual elements, ignoring the background." 
              },
              { 
                type: "image_url", 
                image_url: { 
                  url: processedImageUrl,
                  detail: "high"
                } 
              }
            ]
          }
        ],
        max_tokens: 300
      });
    });

    const description = response.choices[0]?.message?.content;
    
    if (!description) {
      throw new Error('No description generated');
    }

    return NextResponse.json({ 
      success: true,
      description 
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to analyze image' 
    }, { status: 500 });
  }
} 