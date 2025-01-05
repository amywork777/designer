import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Add error handling for missing API key
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const BASE_SETTINGS = "Professional product visualization from a 3/4 isometric view (front-right, slightly elevated angle). Clean design without text or labels. White/neutral background with subtle shadows.";

export async function POST(request: Request) {
  try {
    const { prompt, mode, inputImage } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    let finalPrompt = prompt;

    // If we have an input image, analyze it first with GPT-4
    if (mode === 'edit' && inputImage) {
      // First analyze the image with GPT-4
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Analyze this product design and describe its key features, materials, and style. Focus on physical characteristics that would be important for creating a variation." 
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
        max_tokens: 300,
      });

      const imageAnalysis = visionResponse.choices[0]?.message?.content;

      if (!imageAnalysis) {
        throw new Error('Failed to analyze image');
      }

      // Combine the analysis with the user's prompt for the final generation
      finalPrompt = `${BASE_SETTINGS}
        Based on this reference design: ${imageAnalysis}
        Create a new design with these modifications: ${prompt}
        Maintain the core design language while incorporating the requested changes.
        Ensure the output is a high-quality, professional product visualization.`;
    }

    // Generate the new image using DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    const generatedImage = imageResponse.data[0]?.url;

    if (!generatedImage) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: generatedImage,
      description: imageResponse.data[0]?.revised_prompt || null
    });

  } catch (error: any) {
    console.error('Generation failed:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate image',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}
