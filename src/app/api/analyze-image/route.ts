import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { inputImage, prompt } = await request.json();

    if (!inputImage) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Analyze the image with GPT-4
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: prompt || "Analyze this product design and provide a one-sentence description of what it is."
            },
            {
              type: "image_url",
              image_url: {
                url: inputImage
              }
            }
          ],
        }
      ],
      max_tokens: 100,
    });

    const description = visionResponse.choices[0]?.message?.content;

    if (!description) {
      return NextResponse.json(
        { error: 'Failed to analyze image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      description
    });

  } catch (error: any) {
    console.error('Analysis failed:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to analyze image',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
} 