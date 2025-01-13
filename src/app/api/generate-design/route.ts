import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { prompt, mode, style, originalDescription, userId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let enhancedPrompt = prompt;
    if (mode === 'edit' && originalDescription) {
      enhancedPrompt = `Create a new version of this design with the following specific changes: ${prompt}. 
        Important: Focus ONLY on modifying these aspects while maintaining all other elements from the original design.
        The original design was: ${originalDescription}.
        Make the requested changes prominent and clear in the new version.`;
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: style || "natural",
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