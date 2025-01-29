import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = `Create a 3D model with these specific requirements:
- Pure white or transparent background, no environmental elements
- Isometric view to show depth and dimension
- Professional 3D rendering with clear details
- Clean, modern aesthetic
- High contrast lighting to emphasize depth
- Sharp, clear edges and surfaces
Maintain the same style as the reference image while keeping these requirements.`;

interface ImageUrlObject {
  type: string;
  image_url: {
    url: string;
    detail: string;
  };
}

interface RequestBody {
  imageUrl: string;
  prompt: string;
}

export async function POST(request: Request) {
  console.log('4. EditImage API called');
  try {
    const { imageUrl, prompt } = await request.json();
    console.log('5. Request parsed', {
      hasImageUrl: !!imageUrl,
      promptLength: prompt?.length
    });

    if (!imageUrl || !prompt) {
      console.log('6. Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Image URL and prompt are required' },
        { status: 400 }
      );
    }

    // First use GPT-4 Vision to analyze the image
    console.log('7. Starting Vision analysis');
    let visionResponse;
    try {
      visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a 3D artist specializing in isometric views and clean designs."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this 3D model's appearance, focusing on geometry, materials, and scale."
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
        max_tokens: 500
      });
      console.log('8. Vision analysis completed successfully');
    } catch (e) {
      console.error('Vision analysis error:', e);
      return NextResponse.json({ 
        success: false, 
        error: e instanceof Error ? e.message : 'Vision analysis failed'
      }, { status: 500 });
    }

    const currentDesign = visionResponse.choices[0]?.message?.content;
    if (!currentDesign) {
      throw new Error('Failed to analyze model');
    }

    // Then use DALL-E to generate the new image
    console.log('9. Starting DALL-E generation');
    let dalleResponse;
    try {
      dalleResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${BASE_SETTINGS}
          Starting with this 3D model: ${currentDesign}
          Make these changes while maintaining isometric view and clean background: ${prompt}`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });
      console.log('10. DALL-E generation completed successfully');
    } catch (e) {
      console.error('DALL-E generation error:', e);
      return NextResponse.json({ 
        success: false, 
        error: e instanceof Error ? e.message : 'Image generation failed'
      }, { status: 500 });
    }

    if (!dalleResponse.data?.[0]?.url) {
      throw new Error('No image generated');
    }

    return NextResponse.json({
      success: true,
      imageUrl: dalleResponse.data[0].url
    });
  } catch (error: any) {
    console.error('Edit error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to edit image' 
    }, { status: 500 });
  }
} 