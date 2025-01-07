import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = "centered composition, clean white background, high quality";

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
  try {
    const body: RequestBody = await request.json();
    const { imageUrl, prompt } = body;

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { success: false, error: 'Image URL and prompt are required' },
        { status: 400 }
      );
    }

    // First analyze the current image
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a 3D artist."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this 3D model's appearance."
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

    const currentDesign = visionResponse.choices[0]?.message?.content;
    
    if (!currentDesign) {
      throw new Error('Failed to analyze model');
    }

    // Generate new image with modifications
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `${BASE_SETTINGS}
        Starting with this 3D model: ${currentDesign}
        Make these changes: ${prompt}`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    if (!response.data?.[0]?.url) {
      throw new Error('No image generated');
    }

    return NextResponse.json({
      success: true,
      imageUrl: response.data[0].url
    });

  } catch (error) {
    console.error('Error in editImage API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to edit image' },
      { status: 500 }
    );
  }
} 