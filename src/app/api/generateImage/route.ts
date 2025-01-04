import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { prompt, currentImage } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // First, analyze the current image with GPT-4o
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Describe this product design in detail, focusing on its key features, materials, and design elements." 
            },
            {
              type: "image_url",
              image_url: {
                url: currentImage
              }
            }
          ],
        }
      ],
      max_tokens: 150,
    });

    const imageAnalysis = visionResponse.choices[0]?.message?.content;
    if (!imageAnalysis) {
      throw new Error('Failed to analyze current image');
    }

    // Base settings for product visualization
    const basePrompt = "Professional product visualization from a 3/4 isometric view. Clean design without text or labels. White/neutral background with subtle shadows. ";

    // Create a detailed prompt combining the original image analysis and requested changes
    const detailedPrompt = `${basePrompt}
Starting with this design: ${imageAnalysis}
Make the following modifications: ${prompt}
Maintain the original design's core elements while applying these changes.
Ensure the new design matches the style and perspective of the original.`;

    // Generate new image with DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: detailedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    if (!response.data?.[0]?.url) {
      throw new Error('No image generated');
    }

    return NextResponse.json({
      success: true,
      imageUrl: response.data[0].url,
      analysis: imageAnalysis
    });

  } catch (error) {
    console.error('Image generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
