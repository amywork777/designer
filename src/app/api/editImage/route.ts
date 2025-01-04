import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = "Professional product visualization from a 3/4 isometric view (front-right, slightly elevated angle). Clean design without text or labels. White/neutral background with subtle shadows. ";

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
          content: "You are a product design expert. Analyze the provided image and describe its key characteristics."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this product's current design, focusing on its physical characteristics."
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
      throw new Error('Failed to analyze current design');
    }

    // Generate new image with modifications
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `${BASE_SETTINGS}
        Starting with this design: ${currentDesign}
        
        Apply these modifications: ${prompt}
        
        Maintain the same professional quality and style while incorporating the requested changes.`,
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