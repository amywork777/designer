import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  console.log('4. API route called');
  
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  try {
    const { prompt } = await request.json();
    console.log('5. Received prompt:', prompt);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const basePrompt = `Create a 3D model design: ${prompt}`;
    console.log('6. Calling DALL-E with prompt:', basePrompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: basePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    console.log('7. DALL-E response received');
    const tempUserId = 'temp-user-123';
    
    console.log('8. Attempting to save to Firebase...');
    const savedDesign = await saveDesignToFirebase({
      imageUrl: response.data[0].url,
      prompt: basePrompt,
      userId: tempUserId,
      mode: 'generated'
    });
    console.log('9. Firebase save result:', savedDesign);

    return NextResponse.json({
      success: true,
      imageUrl: savedDesign.imageUrl,
      designId: savedDesign.id
    });

  } catch (error) {
    console.error('10. Generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
} 