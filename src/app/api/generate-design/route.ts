import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const STYLE_PROMPTS = {
  cartoon: "ultra-cute chibi style, soft rounded shapes, vibrant colors, clean lines",
  realistic: "photorealistic 3D render, detailed textures, physically accurate materials",
  geometric: "low-poly 3D model, clean geometric shapes, modern minimal style"
};

export async function POST(req: Request) {
  try {
    const { prompt, mode, style, originalDescription, userId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get style modifier from STYLE_PROMPTS
    const styleModifier = STYLE_PROMPTS[style?.toLowerCase()] || '';

    // Construct enhanced prompt with style
    let enhancedPrompt = `Create a 3D model design with ${styleModifier}: ${prompt}`;

    console.log('Final prompt:', enhancedPrompt); // For debugging

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image generated');
    }

    // Save to Firebase
    const savedDesign = await saveDesignToFirebase({
      imageUrl,
      prompt: enhancedPrompt,
      userId,
      mode: 'generated'
    });

    return NextResponse.json({ 
      success: true, 
      imageUrl: savedDesign.imageUrl,
      designId: savedDesign.id,
      prompt: enhancedPrompt
    });

  } catch (error) {
    console.error('Design generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate design' },
      { status: 500 }
    );
  }
} 