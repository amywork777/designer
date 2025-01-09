import { NextResponse } from 'next/server';
import OpenAI from 'openai';

interface GenerateRequestBody {
  text?: string;
  image?: string;
  style?: 'cartoon' | 'realistic' | 'geometric';
  mode?: 'edit' | 'generate';
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

const STYLE_PROMPTS: Record<string, string> = {
  cartoon: "ultra-cute chibi style, soft rounded shapes, vibrant colors, clean lines",
  realistic: "photorealistic 3D render, detailed textures, physically accurate materials",
  geometric: "low-poly 3D model, clean geometric shapes, modern minimal style"
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, style, styleDescription, referenceImages } = body;

    let finalPrompt = '';

    // If there are reference images, analyze them first
    if (referenceImages?.length > 0) {
      try {
        // Process the reference image URL
        const imageUrl = referenceImages[0];
        let processedImageUrl = imageUrl;

        // If it's a base64 image, we need to handle it differently
        if (imageUrl.startsWith('data:image')) {
          // Extract the base64 data
          processedImageUrl = imageUrl;
        } else if (imageUrl.startsWith('blob:')) {
          throw new Error('Blob URLs are not supported. Please convert to base64 first.');
        }

        // Analyze the image with GPT-4
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a 3D design expert. Analyze this reference image and describe its key visual elements, style, and design characteristics."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Describe the key visual elements and design characteristics of this reference image that should be incorporated into a new 3D design."
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
          max_tokens: 500
        });

        const analysis = analysisResponse.choices[0]?.message?.content;
        if (!analysis) {
          throw new Error('Failed to analyze image - no content in response');
        }
        
        // Construct prompt combining reference analysis, style, and user text
        finalPrompt = `Create a 3D model design that combines these elements:

1. Reference Design Elements:
${analysis}

2. Requested Changes/Additions:
${text}

${style ? `3. Style Guidelines:
${styleDescription}` : ''}

Important: Maintain the key characteristics from the reference while incorporating the requested changes.`;

      } catch (error) {
        console.error('Error analyzing reference image:', error);
        throw new Error(`Failed to analyze reference image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // If no reference images, use the simple prompt
      finalPrompt = style 
        ? `Create a 3D model: ${text}. Style: ${styleDescription}`
        : `Create a 3D model: ${text}`;
    }

    console.log('Final prompt:', finalPrompt);

    // Generate the image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: style === 'realistic' ? 'natural' : 'vivid'
    });

    return NextResponse.json({
      success: true,
      imageUrl: response.data[0].url,
      prompt: finalPrompt
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
} 