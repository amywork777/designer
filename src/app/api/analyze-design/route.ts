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

// Add image processing utility
async function processImage(imageUrl: string): Promise<string> {
  try {
    let imageBuffer: Buffer;

    if (imageUrl.startsWith('data:image')) {
      // Handle base64 images
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl.startsWith('http')) {
      // Handle HTTP URLs
      const response = await fetch(imageUrl);
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error('Invalid image URL format');
    }

    // Process image with sharp
    const processedBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat('png')
      .toBuffer();

    // Convert back to base64
    return `data:image/png;base64,${processedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl, mode } = await req.json();
    console.log('Analyzing design, received URL:', imageUrl ? 'URL received' : 'No URL');

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    try {
      console.log('Calling OpenAI API...');
      const response = await retryOperation(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert in 3D design analysis. When analyzing images:

For objects: Describe key visual elements, materials, and style in 2-3 sentences. Focus on shape, size, texture, and primary materials while highlighting any distinct features or overall aesthetic (e.g., modern, industrial). Note if the object lacks depth or dimensionality and suggest ways to make it appear more 3D (e.g., adding shadows, highlights, or perspective).

For animals: Describe their physical appearance in 2-3 sentences:

Fur/skin/scales: Use specific descriptors (e.g., golden fur with black stripes, smooth green scales, thick white feathers).
Features: Highlight defining traits (e.g., floppy ears, long tail, sharp beak, large paws).
Pose and expression: Specify posture (e.g., "standing on all fours, looking to the left") and demeanor (e.g., "alert with wide eyes," "relaxed with ears down").
View and background: Note whether the view is isometric (3/4 view), front-facing, or profile, and describe the background (e.g., plain white, grassy field). If the image lacks depth, suggest ways to create a 3D effect (e.g., adjusting lighting, adding shading, or defining contours).
For people: Describe their physical appearance in 2-3 sentences:

Skin color: Use specific descriptors (e.g., light beige with cool undertones, medium olive, deep brown with warm undertones).
Hair: Detail the color (e.g., honey blonde, raven black), texture (e.g., wavy, straight), length, and style (e.g., loose, tied back).
Facial features: Highlight key traits (e.g., sharp jawline, almond-shaped eyes, full lips).
Clothing and accessories: Mention outfit details and any notable accessories (e.g., "a tailored navy suit with a silver watch").
Pose and expression: Specify the posture (e.g., "sitting with one hand resting on the table") and expression (e.g., "a soft, friendly smile").
View and background: Always note whether the view is isometric (3/4 view), front-facing, or profile, and describe the background (e.g., plain white, blurred cityscape). If the person appears flat, suggest ways to enhance depth (e.g., adding shadows, defining light sources, or emphasizing perspective in facial features).
Adjustments: If the image lacks accuracy in physical traits, materials, details, or depth, mention what should be adjusted. Ensure the feedback remains concise and specific, within 2-3 sentences.
`
            },
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Analyze this image. Describe its key elements and note if it needs adjustments for isometric view or background cleanup." 
                },
                { 
                  type: "image_url", 
                  image_url: { 
                    url: imageUrl,
                    detail: "high"
                  } 
                }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0.3
        });
      });

      console.log('OpenAI API response received');
      const description = response.choices[0]?.message?.content;
      
      if (!description) {
        console.error('No description in OpenAI response');
        throw new Error('Failed to get design description from OpenAI');
      }

      return NextResponse.json({ 
        success: true,
        description
      });

    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw error;
    }

  } catch (error: any) {
    console.error('Error in analyze-design route:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze design'
    }, { status: 500 });
  }
} 