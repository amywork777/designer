import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define style prompts
const STYLE_PROMPTS = {
  cartoon: "Create a cute, stylized 3D model with soft rounded shapes, vibrant colors, and clean lines in a chibi cartoon style. The model should be: ",
  realistic: "Create a photorealistic 3D model with detailed textures, physically accurate materials, and proper lighting. The model should be: ",
  geometric: "Create a minimalist 3D model using clean geometric shapes, low-poly design, and modern aesthetic. The model should be: "
};

export async function POST(request: Request) {
  console.log('API route called');
  
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  try {
    const { prompt, style } = await request.json();
    console.log('Received prompt:', prompt, 'style:', style);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Build the complete prompt using the style
    const stylePrefix = style && STYLE_PROMPTS[style] ? STYLE_PROMPTS[style] : "Create a 3D model that is: ";
    const fullPrompt = stylePrefix + prompt;
    
    console.log('Generated full prompt:', fullPrompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const tempUserId = 'temp-user-123';
    
    const savedDesign = await saveDesignToFirebase({
      imageUrl: response.data[0].url,
      prompt: fullPrompt,
      style: style, // Save the style with the design
      userId: tempUserId,
      mode: 'generated'
    });

    return NextResponse.json({
      success: true,
      imageUrl: savedDesign.imageUrl,
      designId: savedDesign.id,
      prompt: fullPrompt // Return the full prompt for reference
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}