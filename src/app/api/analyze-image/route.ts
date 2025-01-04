import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Handle base64 image data
    let imageUrlForAPI = imageUrl;
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
      imageUrlForAPI = `data:image/jpeg;base64,${imageUrl}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: prompt || "Analyze this product design and describe what it is." 
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrlForAPI
              }
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    const description = response.choices[0]?.message?.content;

    if (!description) {
      return NextResponse.json(
        { error: 'No analysis generated' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      description
    });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    
    // Better error handling
    if (error.response?.status === 400) {
      return NextResponse.json(
        { error: 'Invalid image format or URL' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to analyze image',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
} 