import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { imageUrl, additionalDetails } = await req.json();

    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    // Analyze the sketch using GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a product design expert. Analyze the provided sketch and describe the product in detail, including its form, features, and apparent functionality. Focus on physical characteristics that would be relevant for creating a 3D model."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this product sketch${additionalDetails ? ` with these additional details: ${additionalDetails}` : ''}.
              Describe the product's physical characteristics, dimensions, and key features that should be maintained in a 3D rendering.`
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
      ]
    });

    const description = response.choices[0]?.message?.content;
    
    if (!description) {
      throw new Error('Failed to analyze sketch');
    }

    return NextResponse.json({ 
      success: true, 
      description 
    });

  } catch (error) {
    console.error('Sketch analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze sketch'
      }, 
      { status: 500 }
    );
  }
} 